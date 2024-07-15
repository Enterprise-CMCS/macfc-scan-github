# Scan GitHub for DevSecOps (DSO) Events Action

This action uses the GitHub Actions API to scan for event data to send the MACBIS DSO Metrics API.

## Inputs

| Name | Description | Required | Default |
| ---- | ----------- | -------- | ------- |
| `scan-github-version` | The version constraint for the Enterprise-CMCS/mac-fc-dso-metrics/cmd/scan-github program in semantic version syntax. Defaults to the latest version (we recommend pinning to a specific version or range) | No | Latest Version |
| `aws-region` | (Optional) AWS region | No | `us-east-1` |
| `oidc-role` | (Optional) The OIDC role to assume that has permission to assume the DSO Metrics cross-account role. If not provided, AWS credentials with this permission must be set in the environment when this action is run | No | N/A |
| `oidc-role-session-name` | (Optional) OIDC role session name | No | `ReportDSOEvents` |
| `aws-account-id` | The AWS account ID containing the DSO Metrics cross-account role used for reporting the event | Yes | N/A |
| `github-access-token` | A GitHub token with repo scope for the target repo | Yes | N/A |
| `scan-config` | A YAML file with a valid configuration for the scan-github tool. See below for the syntax of the configuration | Yes | N/A |

## Usage

Here's an example of how to use this action in a workflow:

```yaml
name: Send DSO metrics events

on:
  schedule:
  - cron:  '0 * * * *'

permissions:
  id-token: write   # This is required for requesting the JWT for OIDC

jobs:
  SendDSOEvents:
  - name: Send DSO events
    uses: Enterprise-CMCS/mac-fc-scan-github@v1.0.1
    with:
      aws-account-id: {your aws account ID}
      oidc-role: arn:aws:iam::{your aws account ID}:role/delegatedadmin/developer/professor-mac-github-oidc
      github-access-token: ${{ secrets.GITHUB_ACCESS_TOKEN }}
      scan-config: |
        events:  # a list of event specifications such as the following one
        - type: test  # test or deploy

          # The name, team, and environment of the events to create when matching workflows are found (all required; "none" is allowed for environment)
          name: e2e
          team: MAC-FC
          environment: prod

          # Which GitHub repo and workflow to check for runs
          owner: Enterprise-CMCS
          repo: mac-fc-professor-mac
          workflowfilename: build-and-deploy.yml

          # Optional: only check runs associated with this branch
          branch: main

          # Optional section: start the event when this job/step starts.
          # If not specified, the event starts when the workflow starts.
          start:
            # You can specify a job or a job and a step. See "Specifying jobs" below
            job: build-push-deploy-prod / test-server / Run e2e tests
            step: start tests

          # Required if "start" is set: end the event when this job/step ends.
          end:
            job: build-push-deploy-prod / test-server / Run e2e tests
            step: check test results
```

### Specifying jobs
This program uses the job names returned by the GitHub API to match the job name that you specify in your event configuration. The name returned by the GitHub API varies depending on your GitHub Actions workflow file, so there are some gotchas to be aware of.

#### Job name vs Job ID
If you specify the [`jobs.job_id.name`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idname) field in your workflow, you must use this name in the `scan-github` configuration. Otherwise, specify the [`jobs.job_id`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_id) field.

```yaml
# GitHub Actions workflow file
# ...
jobs:
  foo:
    # ...
  bar:
    name: Perform bar
    # ...
```

```yaml
# scan-github configuration

# foo event
# ...
start:
  job: foo
end:
  job: foo

 # bar event
 # ...
start:
  job: Perform bar
end:
  job: Perform bar
  ```



#### Matrixes
If you specify the [`jobs.<job_id>.strategy.matrix`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix) field in your workflow, you must enclose the matrix value in paretheses after the job name.

```yaml
# GitHub Actions workflow file
# ...
jobs:
  foo:
    name: Perform foo
    strategy:
      matrix:
        environment: [dev, prod]
```

```yaml
# scan-github configuration

# foo event in dev
# ...
start:
  job: Perform foo (dev)
end:
  job: Perform foo (dev)

 # foo event in prod
 # ...
start:
  job: Perform foo (prod)
end:
  job: Perform foo (prod)
  ```
#### Reusable workflows
If your workflow calls a [reusable workflow](https://docs.github.com/en/actions/using-workflows/reusing-workflows) then the GitHub API does not report that call as a single job. Instead it reports all the individual jobs inside the reusable workflow, with the reusable workflow's name prepended to the job name. Use these longer names when specifying start or end jobs. For example, in the above sample YAML, the "Run e2e tests" job is in the "test-server" reusable workflow, which is itself called by the "build-push-deploy-prod" reusable workflow, which is called by the main build-and-deploy.yml workflow.
```
├── Main Workflow: build-and-deploy.yml
│   └── Reusable Workflow: build-push-deploy-prod
│       └── Reusable Workflow: test-server
│           └── Job: Run e2e tests
Final job name: build-push-deploy-prod / test-server / Run e2e tests
```

### Success/failure rules for skipped jobs:
If you specify a specific job/step to start and end the event and some jobs are skipped, then the following rules apply:
- An event is emitted if and only if the start job/step runs (status == "completed" and conclusion != "skipped").
- The event has a result if and only if the end job/step has "completed" status, which could mean it ran or could mean it was skipped, cancelled, etc.
- If the event has a result, then it is success/pass if and only if the event job/step has "successful" conclusion, regardless of whether preceding steps (including the start job/step) were successful.
