import { spawnSync } from "child_process";
import { arch, type } from "os";
import * as core from "@actions/core";
import { Octokit } from "@octokit/rest";
import * as semver from "semver";
import fs from "fs/promises";
import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";

const releaseRepoOwner = "Enterprise-CMCS";
const releaseRepo = "mac-fc-scan-github-releases";
const releaseBinaryName = "scan-github";
const windowsType = "Windows_NT"; // https://nodejs.org/api/os.html#ostype

const octokit = new Octokit({
  auth: core.getInput("github-access-token"),
});

type ListReleasesResponseDataType = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.repos.listReleases
>;

function formatReleaseName(version: string, type: string, arch: string) {
  let name = `${releaseBinaryName}_${version}_${type}_${arch}`;
  if (type === windowsType) {
    name += ".exe";
  }
  return name;
}

async function downloadAsset(name: string, url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error downloading asset: ${response.statusText}`);
  }

  const data = await response.arrayBuffer();
  const buffer = Buffer.from(data);
  try {
    await fs.writeFile(name, buffer, { mode: 755 });
  } catch (error) {
    throw new Error(`Error writing the release asset to file: ${error}`);
  }
}

async function downloadRelease(version: string): Promise<string> {
  let releases: ListReleasesResponseDataType;
  try {
    const response = await octokit.repos.listReleases({
      owner: releaseRepoOwner,
      repo: releaseRepo,
    });
    releases = response.data;
  } catch (error) {
    throw new Error(
      `Error listing releases for ${releaseRepoOwner}/${releaseRepo}: ${error}`
    );
  }

  // sort descending by tag so that "*" selects the latest version
  releases.sort((a, b) => semver.rcompare(a.tag_name, b.tag_name));
  const validRelease = releases.find((release) =>
    semver.satisfies(release.tag_name, version)
  );
  if (!validRelease) {
    throw new Error(
      `No release found that satisfies version constraint: ${version}`
    );
  }
  console.log(`Using release ${validRelease.name}`);

  const nodeArch = arch();
  const nodeType = type();
  const asset = validRelease.assets.find(
    (a) =>
      a.name === formatReleaseName(validRelease.tag_name, nodeType, nodeArch)
  );
  if (!asset) {
    throw new Error(
      `No release asset found for runner arch: ${nodeArch} and runner type: ${nodeType}`
    );
  }

  try {
    await downloadAsset(asset.name, asset.browser_download_url);
  } catch (error) {
    throw new Error(`Error downloading release asset: ${error}`);
  }

  return asset.name;
}

async function main() {
  const version = core.getInput("version");
  const token = core.getInput("github-access-token");
  const config = core.getInput("config");
  const args = core.getInput("args");

  let releaseName;
  try {
    releaseName = await downloadRelease(version);
  } catch (error) {
    console.error(`Error downloading release: ${error}`);
    process.exit(1);
  }

  let returns;
  const command =
    type() === windowsType
      ? `${releaseName} ${args}`
      : `./${releaseName} ${args}`;
  try {
    returns = spawnSync(command, {
      shell: true,
      env: {
        ...process.env,
        GITHUB_ACCESS_TOKEN: token,
        DSO_GITHUB_SCANNER_CONFIG: config,
      },
    });
  } catch (error) {
    console.error(`Error spawning child process: ${error}`);
    process.exit(1);
  }

  const status = returns.status ?? 1;
  const stdout = returns.stdout.toString();
  const stderr = returns.stderr.toString();

  // print the scan-github output in the GitHub Action logs
  console.log(stdout);
  console.error(stderr);

  core.setOutput("exit-code", status);
  core.setOutput("output", stdout);
  core.setOutput("error-output", stderr);

  process.exit(status);
}

if (require.main === module) {
  main();
}
