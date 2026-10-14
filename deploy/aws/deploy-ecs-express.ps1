param(
    [string]$Region = "ap-south-1",
    [string]$ServiceName = "ai-traffic-adaptation",
    [string]$RepositoryName = "ai-traffic-adaptation",
    [string]$ExecutionRoleName = "ecsTaskExecutionRole",
    [string]$InfrastructureRoleName = "ecsInfrastructureRoleForExpressServices"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Invoke-AwsJson {
    param([string[]]$Arguments)
    $raw = & aws @Arguments --region $Region --output json --no-cli-pager
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI command failed: aws $($Arguments -join ' ')"
    }
    if (-not $raw) { return $null }
    return ($raw | ConvertFrom-Json)
}

try {
    $identity = Invoke-AwsJson -Arguments @("sts", "get-caller-identity")
} catch {
    throw "AWS credentials are missing or expired. Run 'aws login', then rerun this script. $($_.Exception.Message)"
}

$accountId = $identity.Account
$registry = "$accountId.dkr.ecr.$Region.amazonaws.com"
$image = "$registry/${RepositoryName}:latest"

Write-Host "Building Linux container from $RepoRoot"
Push-Location $RepoRoot
try {
    & docker build --platform linux/amd64 -t $image .
    if ($LASTEXITCODE -ne 0) { throw "Docker image build failed." }
} finally {
    Pop-Location
}

$repoResult = & aws ecr describe-repositories --repository-names $RepositoryName --region $Region --output json --no-cli-pager 2>$null
if ($LASTEXITCODE -ne 0) {
    $null = Invoke-AwsJson -Arguments @("ecr", "create-repository", "--repository-name", $RepositoryName, "--image-scanning-configuration", "scanOnPush=true")
}

$executionTrustPath = Join-Path $env:TEMP "ata-ecs-task-trust.json"
$infrastructureTrustPath = Join-Path $env:TEMP "ata-ecs-infrastructure-trust.json"
@'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}
'@ | Set-Content -LiteralPath $executionTrustPath -Encoding ascii
@'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs.amazonaws.com"},"Action":"sts:AssumeRole"}]}
'@ | Set-Content -LiteralPath $infrastructureTrustPath -Encoding ascii

function Ensure-IamRole {
    param([string]$Name, [string]$TrustFile, [string]$ManagedPolicyArn)
    $roleResult = & aws iam get-role --role-name $Name --region $Region --output json --no-cli-pager 2>$null
    if ($LASTEXITCODE -ne 0) {
        $roleResult = & aws iam create-role --role-name $Name --assume-role-policy-document "file://$TrustFile" --region $Region --output json --no-cli-pager
        if ($LASTEXITCODE -ne 0) { throw "Could not create IAM role '$Name'." }
    }
    & aws iam attach-role-policy --role-name $Name --policy-arn $ManagedPolicyArn --region $Region --no-cli-pager
    if ($LASTEXITCODE -ne 0) { throw "Could not attach the required policy to IAM role '$Name'." }
}

Ensure-IamRole -Name $ExecutionRoleName -TrustFile $executionTrustPath -ManagedPolicyArn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
Ensure-IamRole -Name $InfrastructureRoleName -TrustFile $infrastructureTrustPath -ManagedPolicyArn "arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices"
Start-Sleep -Seconds 15

$password = & aws ecr get-login-password --region $Region --no-cli-pager
if ($LASTEXITCODE -ne 0) { throw "Could not get an ECR login token." }
$password | & docker login --username AWS --password-stdin $registry
if ($LASTEXITCODE -ne 0) { throw "Could not authenticate Docker to ECR." }

& docker push $image
if ($LASTEXITCODE -ne 0) { throw "Could not push the image to ECR." }

$executionRoleArn = "arn:aws:iam::$accountId`:role/$ExecutionRoleName"
$infrastructureRoleArn = "arn:aws:iam::$accountId`:role/$InfrastructureRoleName"
$primaryContainer = @{
    image = $image
    containerPort = 7860
    environment = @(@{ name = "PORT"; value = "7860" })
} | ConvertTo-Json -Compress -Depth 5

$result = Invoke-AwsJson -Arguments @(
    "ecs", "create-express-gateway-service",
    "--service-name", $ServiceName,
    "--execution-role-arn", $executionRoleArn,
    "--infrastructure-role-arn", $infrastructureRoleArn,
    "--primary-container", $primaryContainer,
    "--health-check-path", "/dashboard/api/status",
    "--cpu", "2048",
    "--memory", "4096",
    "--scaling-target", '{"minTaskCount":1,"maxTaskCount":2}',
    "--monitor-resources", "DEPLOYMENT"
)

Write-Host "ECS Express Mode deployment request completed."
$result | ConvertTo-Json -Depth 12
Remove-Item -LiteralPath $executionTrustPath, $infrastructureTrustPath -Force -ErrorAction SilentlyContinue

