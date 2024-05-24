# scan-github

This Action is a thin wrapper around the CLI program `scan-github` that is [housed in the mac-fc-dso-metrics repo](https://github.com/Enterprise-CMCS/mac-fc-dso-metrics/tree/main/cmd/scan-github). Please see the README of that program for documentation.

For documentation of the inputs and outputs of this Action, please see `action.yml`.

To report events, the action requires valid AWS credentials stored in the environment when the action is run. These credentials must provide access to an IAM role that has an entry on the ACL used by the MACBIS DevSecOps Metrics API to determine the API permissions. For more information, please see the documentation for onboarding to the MACBIS DevSecOps Metrics API in Confluence [TODO]

For an example of usage, please see the workflow that tests the action: `.github/workflows/test-scan-github.yml`

