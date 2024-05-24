### Compiling the Action code

The action is written in Typescript at `src/index.ts`, and it uses [`ncc`](https://github.com/vercel/ncc) to compile the Typescript module into a single file with all of its dependencies, which is referenced in the `action.yml`. It uses [`pnpm`](https://pnpm.io/installation) as a package manager. To compile:

1. [Install pnpm](https://pnpm.io/installation)
2. Run `pnpm compile`

After changing the source code in `src/index.ts`, you must compile the code to see the changes reflected in the GitHub Action. There is a workflow, `.github/workflows/check-compile.yml`, that will remind you to do this by failing if it finds that the code was not compiled.

