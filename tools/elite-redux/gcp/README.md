# Overview

The Elite Redux showdown server is hosted on Google Cloud Platform.
The server is dockerized and run via a [Cloud Run](https://cloud.google.com/run?hl=en).
The service is deployed via a [GitHub Actions Workflow](https://github.com/ER-Showdown/pokemon-showdown-ER/blob/master/.github/workflows/google-cloudrun-docker.yml).
The workflow automatically builds and deploys the docker container to Google [Artifact Registry](https://cloud.google.com/artifact-registry) and then deploys a new revision to the Cloud Run service.
