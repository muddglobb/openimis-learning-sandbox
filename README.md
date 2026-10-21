<center>
<img src="https://openimis.org/themes/custom/ffw/logo.svg" width="200px" alt="openIMIS logo" />
</center>

# openIMIS Distribution

This repository provides configuration files for deploying openIMIS via Docker. This is intended to help you setup all components to quickly setup, test and evaluate the solution.

> ## About this fork
>
> This is a **fork** of [openimis/openimis-dist_dkr](https://github.com/openimis/openimis-dist_dkr).
> The upstream Docker distribution is unchanged; everything added by this fork lives in
> [`frontend/`](frontend/README.md) — an interactive learning sandbox for the hospital claim
> lifecycle, Mobile JKN, and P-Care, built on openIMIS GraphQL and HL7 FHIR R4.
>
> Upstream is tracked as the `upstream` remote:
>
> ```bash
> git remote add upstream https://github.com/openimis/openimis-dist_dkr.git
> git fetch upstream && git merge upstream/develop
> ```
>
> Licensed under **AGPL v3**, same as upstream. See [`LICENSE.md`](LICENSE.md).

Detailed instructions are in our Wiki: [Installation Guide](https://openimis.atlassian.net/wiki/spaces/OP/pages/963182705/MO1.1+Install+the+modular+openIMIS+using+Docker)

[![DPG Badge](https://img.shields.io/badge/Verified-DPG-3333AB?logo=data:image/svg%2bxml;base64,PHN2ZyB3aWR0aD0iMzEiIGhlaWdodD0iMzMiIHZpZXdCb3g9IjAgMCAzMSAzMyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0LjIwMDggMjEuMzY3OEwxMC4xNzM2IDE4LjAxMjRMMTEuNTIxOSAxNi40MDAzTDEzLjk5MjggMTguNDU5TDE5LjYyNjkgMTIuMjExMUwyMS4xOTA5IDEzLjYxNkwxNC4yMDA4IDIxLjM2NzhaTTI0LjYyNDEgOS4zNTEyN0wyNC44MDcxIDMuMDcyOTdMMTguODgxIDUuMTg2NjJMMTUuMzMxNCAtMi4zMzA4MmUtMDVMMTEuNzgyMSA1LjE4NjYyTDUuODU2MDEgMy4wNzI5N0w2LjAzOTA2IDkuMzUxMjdMMCAxMS4xMTc3TDMuODQ1MjEgMTYuMDg5NUwwIDIxLjA2MTJMNi4wMzkwNiAyMi44Mjc3TDUuODU2MDEgMjkuMTA2TDExLjc4MjEgMjYuOTkyM0wxNS4zMzE0IDMyLjE3OUwxOC44ODEgMjYuOTkyM0wyNC44MDcxIDI5LjEwNkwyNC42MjQxIDIyLjgyNzdMMzAuNjYzMSAyMS4wNjEyTDI2LjgxNzYgMTYuMDg5NUwzMC42NjMxIDExLjExNzdMMjQuNjI0MSA5LjM1MTI3WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==)](https://digitalpublicgoods.net/r/openimis)
