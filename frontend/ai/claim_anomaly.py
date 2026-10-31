"""
Deteksi anomali klaim openIMIS (hybrid: aturan bisnis + IsolationForest).

Input  (stdin) : {"claims": [<node GraphQL claims>, ...]}
Output (stdout): {"summary": {...}, "results": [{id, uuid, code, skor, flags, alasan, ...}]}

Pendekatan sama seperti model klaim BPJS di Colab, disesuaikan dengan data openIMIS:
  - "tarif standar" = jumlah (qty x harga katalog) dari item/tindakan pada klaim
  - pembanding = klaim lain dengan diagnosa (ICD) yang sama
  - IsolationForest dilatih per-batch (unsupervised) pada klaim yang dikirim
Aturan menjadi lapisan utama karena IsolationForest buta terhadap fitur yang hampir konstan.
"""

import json
import sys

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

RULES = {
    "rasio_katalog_max": 1.2,   # tagihan > 120% harga katalog
    "rasio_verif_min": 0.8,     # BPJS/penjamin memotong > 20%
    "z_max": 5.0,               # outlier robust z-score (biaya & lama rawat)
    "duplikat_hari": 7,         # klaim sama (peserta+diagnosa) dalam N hari
}
MIN_GROUP = 8      # minimal klaim per ICD untuk pembanding grup
MIN_MODEL = 30     # minimal klaim agar IsolationForest dijalankan

ALASAN = {
    "flag_tagihan": "TAGIHAN_DI_ATAS_HARGA_KATALOG",
    "flag_koreksi": "DIKOREKSI_PENJAMIN_BANYAK",
    "flag_biaya": "BIAYA_OUTLIER_DIAGNOSA",
    "flag_lama": "LAMA_RAWAT_EKSTREM",
    "flag_duplikat": "KLAIM_GANDA",
    "flag_model": "POLA_ANEH_MODEL",
}


def num(v, default=0.0):
    try:
        x = float(v)
        return default if np.isnan(x) else x
    except (TypeError, ValueError):
        return default


def flatten(c):
    lines = []
    for key, sub in (("items", "item"), ("services", "service")):
        for e in c.get(key) or []:
            n = e.get("node", e) if isinstance(e, dict) else {}
            ref = n.get(sub) or {}
            lines.append((num(n.get("qtyProvided"), 1.0), num(n.get("priceAsked")),
                          num(ref.get("price"))))
    catalog = sum(q * p for q, _, p in lines)
    asked = sum(q * a for q, a, _ in lines)
    return len(lines), catalog, asked


def to_frame(claims):
    rows = []
    for c in claims:
        n_lines, catalog, asked = flatten(c)
        rows.append({
            "id": c.get("id"), "uuid": c.get("uuid"), "code": c.get("code"),
            "status": int(num(c.get("status"))),
            "chf": (c.get("insuree") or {}).get("chfId"),
            "icd": (c.get("icd") or {}).get("code") or "?",
            "hf": (c.get("healthFacility") or {}).get("code"),
            "dari": pd.to_datetime(c.get("dateFrom"), errors="coerce"),
            "sampai": pd.to_datetime(c.get("dateTo"), errors="coerce"),
            "claimed": num(c.get("claimed")), "approved": num(c.get("approved")),
            "n_lines": n_lines, "catalog": catalog, "asked": asked,
        })
    return pd.DataFrame(rows)


def robust_z(series, groups):
    """Robust z-score (median/MAD) per grup; grup kecil memakai seluruh data."""
    z = pd.Series(0.0, index=series.index)
    overall_med = series.median()
    overall_mad = (series - overall_med).abs().median() * 1.4826
    for g, idx in series.groupby(groups).groups.items():
        s = series.loc[idx]
        if len(s) >= MIN_GROUP:
            med, mad = s.median(), (s - s.median()).abs().median() * 1.4826
        else:
            med, mad = overall_med, overall_mad
        z.loc[idx] = (s - med) / mad if mad and mad > 0 else 0.0
    return z.clip(-30, 30)


def analyse(claims):
    df = to_frame(claims)
    if df.empty:
        return {"summary": {"total": 0, "flagged": 0, "modelRan": False, "byReason": {}},
                "results": []}

    df["los"] = (df["sampai"] - df["dari"]).dt.days.clip(lower=0)
    df["log_claimed"] = np.log1p(df["claimed"].clip(lower=0))
    df["rasio_katalog"] = (df["claimed"] / df["catalog"].where(df["catalog"] > 0)).clip(0, 20)
    done = df["status"].isin([8, 16]) & (df["claimed"] > 0)
    df["rasio_verif"] = (df["approved"] / df["claimed"].where(df["claimed"] > 0)).where(done).clip(0, 2)
    df["z_biaya"] = robust_z(df["log_claimed"], df["icd"])
    df["z_los"] = robust_z(df["los"].fillna(0), df["icd"])

    # klaim ganda: peserta + diagnosa sama, tanggal mulai berdekatan
    df["flag_duplikat"] = False
    ok = df.dropna(subset=["dari"]).sort_values("dari")
    for _, g in ok.groupby(["chf", "icd"]):
        if len(g) > 1:
            gap_prev = g["dari"].diff().dt.days
            gap_next = (-g["dari"].diff(-1)).dt.days
            hit = (gap_prev <= RULES["duplikat_hari"]) | (gap_next <= RULES["duplikat_hari"])
            df.loc[g.index[hit.values], "flag_duplikat"] = True

    df["flag_tagihan"] = df["rasio_katalog"] > RULES["rasio_katalog_max"]
    df["flag_koreksi"] = df["rasio_verif"] < RULES["rasio_verif_min"]
    df["flag_biaya"] = df["z_biaya"] > RULES["z_max"]
    df["flag_lama"] = df["z_los"] > RULES["z_max"]

    feats = ["log_claimed", "rasio_katalog", "rasio_verif", "los", "n_lines", "z_biaya"]
    x = df[feats].copy()
    x["rasio_katalog"] = x["rasio_katalog"].fillna(1.0)
    x["rasio_verif"] = x["rasio_verif"].fillna(1.0)
    x = x.fillna(0)
    df["skor"] = 0.0
    df["flag_model"] = False
    model_ran = len(df) >= MIN_MODEL
    if model_ran:
        xs = RobustScaler().fit_transform(x)
        iso = IsolationForest(n_estimators=300, max_samples=min(len(df), 50000),
                              contamination=0.05, random_state=42).fit(xs)
        df["skor"] = -iso.score_samples(xs)
        df["flag_model"] = iso.predict(xs) == -1

    flags = list(ALASAN)
    df["perlu_review"] = df[flags].any(axis=1)
    df["alasan"] = df[flags].apply(
        lambda r: "; ".join(ALASAN[c] for c in flags if r[c]), axis=1)

    results = []
    for _, r in df.iterrows():
        results.append({
            "id": r["id"], "uuid": r["uuid"], "code": r["code"], "icd": r["icd"],
            "claimed": r["claimed"], "approved": r["approved"],
            "rasioKatalog": None if pd.isna(r["rasio_katalog"]) else round(float(r["rasio_katalog"]), 2),
            "rasioVerif": None if pd.isna(r["rasio_verif"]) else round(float(r["rasio_verif"]), 2),
            "los": None if pd.isna(r["los"]) else int(r["los"]),
            "skor": round(float(r["skor"]), 4),
            "flags": [c for c in flags if r[c]],
            "perluReview": bool(r["perlu_review"]),
            "alasan": r["alasan"],
        })
    results.sort(key=lambda d: (not d["perluReview"], -d["skor"]))
    return {
        "summary": {
            "total": int(len(df)), "flagged": int(df["perlu_review"].sum()),
            "modelRan": model_ran,
            "byReason": {c: int(df[c].sum()) for c in flags},
            "rules": RULES,
        },
        "results": results,
    }


if __name__ == "__main__":
    payload = json.load(sys.stdin)
    json.dump(analyse(payload.get("claims", [])), sys.stdout, ensure_ascii=False)
