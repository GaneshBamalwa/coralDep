# GCP + Vertex AI Setup

ContextOS uses Vertex AI as the core agent through `backend/vertexAgent.js`. The backend reads Application Default Credentials and calls the configured Gemini model for briefing, chat, and Meridian Lens synthesis.

## 1. Install and Authenticate

```powershell
winget install Google.CloudSDK
gcloud init
gcloud auth login
gcloud auth application-default login
```

## 2. Pick or Create a Project

```powershell
$PROJECT_ID="contextos-dev-$((Get-Random -Minimum 10000 -Maximum 99999))"
$BILLING_ACCOUNT_ID="$(gcloud billing accounts list --format='value(ACCOUNT_ID)' --limit=1)"

gcloud projects create $PROJECT_ID --name="ContextOS Dev"
gcloud config set project $PROJECT_ID
gcloud billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT_ID
```

If you already have a project:

```powershell
$PROJECT_ID="your-existing-project-id"
gcloud config set project $PROJECT_ID
```

## 3. Enable APIs

```powershell
gcloud services enable aiplatform.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
gcloud services enable iam.googleapis.com
gcloud services enable serviceusage.googleapis.com
```

## 4. Grant Local ADC Access

```powershell
$USER_EMAIL="$(gcloud config get-value account)"
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="user:$USER_EMAIL" `
  --role="roles/aiplatform.user"

gcloud auth application-default set-quota-project $PROJECT_ID
```

## 5. Configure ContextOS

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```env
MOCK_MODE=true
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GCLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GCLOUD_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-pro
```

## 6. Install and Run

```powershell
npm run install:all
npm run dev
```

Open:

- Frontend: http://localhost:5173
- Backend health: http://localhost:3001/api/health

## 7. Verify Vertex

```powershell
Invoke-RestMethod http://localhost:3001/api/health | ConvertTo-Json -Depth 5
```

The response should include:

```json
{
  "vertex": {
    "project": "your-gcp-project-id",
    "location": "us-central1",
    "model": "gemini-2.5-pro"
  }
}
```
