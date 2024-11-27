if ($($args.Count) -ne 1) {
  Write-Error "version.ps1 needs to be called with one of the usual commands (patch/minor/major)"
  exit 1
}


$versionCommand=$args[0]

npm run build --workspaces

# types
npm version --no-git-tag-version $versionCommand -w packages/types
$typesPackage = Get-Content -Raw .\packages\types\package.json | ConvertFrom-Json
$typesVersion = $typesPackage.version
npm run build -w packages/types
npm publish -w packages/types

# server
npm install --save --save-exact @react-remote-state/types@$typesVersion -w .\packages\server
npm version --no-git-tag-version $versionCommand -w packages/server
$serverPackage = Get-Content -Raw .\packages\server\package.json | ConvertFrom-Json
$serverVersion = $serverPackage.version

if ($serverVersion -ne $typesVersion) {
  Write-Error "Server version is desync with Types version"
  exit 1
}


# client
npm install --save --save-exact @react-remote-state/types@$typesVersion -w .\packages\client
npm install --save-dev --save-exact @react-remote-state/server@$serverVersion -w .\packages\client
npm version --no-git-tag-version $versionCommand -w packages/client
$clientPackage = Get-Content -Raw .\packages\client\package.json | ConvertFrom-Json
$clientVersion = $clientPackage.version

if ($clientVersion -ne $typesVersion) {
  Write-Error "Client version is desync with Types version"
  exit 1
}

# workspace
npm version --no-git-tag-version $versionCommand
$workspacePackage = Get-Content -Raw .\package.json | ConvertFrom-Json
$workspaceVersion = $workspacePackage.version

if ($workspaceVersion -ne $typesVersion) {
  Write-Error "Workspace version is desync with Types version"
  exit 1
}
