# Slack Sales Dashboard - AI Context

**Version**: 2.0 (Post Phase 1 Cleanup)
**Updated**: 2026-02-03

---

## Stack

- **Frontend**: React 19 + Vite 6 (Vercel)
- **Backend**: Python/FastAPI at `api.ownertechnology.com`
- **Auth**: JWT via `apiClient` (Leaderboard already migrated)
- **Database**: PostgreSQL (via backend API)
- **Legacy**: Some pages still use Supabase (progressive migration)
- **Webhooks**: n8n for sales declarations & EOD reports

---

## Sacred Rules

### 🔴 NEVER TOUCH
**NDA/Sales Declarations flow and all related code:**
- ContractNew.jsx (NDA generation page)
- contract.css
- contracts/schemas.js, contracts/format.js
- utils/generateContractPdf.js
- All sales declaration webhooks (n8n)
- All related API calls

These are core business features. Any changes require explicit approval.

---

## Core Features (Keep)

### Authentication
- JWT via backend: `apiClient.js`, `ProtectedRoute.jsx`, `Login.jsx`
- Supabase clients: `supabase.js`, `lib/supabaseClient.js` (keep until full migration)

### Main Pages
- **Leaderboard** (`/`) - Public, already uses `apiClient` ✅
- **EmployeeSales** (`/employee/:name`) - Employee detail (click sales name in Leaderboard)
- **LeadsManagement** (`/leads-management`) - Admin lead management
- **AdminLeads** (`/admin/leads`) - Admin analytics
- **TrackingSheet** (`/tracking-sheet`) - Sales rep pipeline
- **MonitoringPerf** (`/monitoring-perf`) - Performance monitoring
- **EODReport** (`/eod-report`) - End of Day reports (Tech/Marketing only)

### NDA Generation (SACRED)
- **ContractNew** (`/contracts/new`) - NDA/confidentiality clause generator
- All related utilities and CSS

---

## Routes (9 total)

```javascript
// Public (7)
/                    → Leaderboard
/login               → Login
/admin/leads         → AdminLeads
/leads-management    → LeadsManagement
/tracking-sheet      → TrackingSheet
/monitoring-perf     → MonitoringPerf
/eod-report          → EODReport (Tech/Marketing only)

// Protected (2)
/employee/:name      → EmployeeSales (ProtectedRoute)
/contracts/new       → ContractNew (ProtectedRoute)
```

---

## API Client (`apiClient.js`)

### Auth
```javascript
apiClient.login(email, password)
apiClient.getMe()
apiClient.logout()
apiClient.getToken()
apiClient.getUser()
apiClient.hasAccess(pageKey)  // Check permissions - returns true for admin or if user has permission
apiClient.getPermissions()
apiClient.setPermissions(permissions)
```

### Leaderboard (✅ Migrated)
```javascript
apiClient.getLeaderboardStats(period)  // 'current_month' | 'YYYY-MM' | 'all'
apiClient.getLeaderboardChart()
```

### Leads (✅ Migrated)
```javascript
apiClient.get('/leads?page=1&limit=50')                    // Get leads (paginated)
apiClient.get('/leads?search=query')                       // Search leads
apiClient.get('/leads?status=contacted&source=Owner')      // Filter leads
apiClient.patch('/leads/{id}', data)                       // Update lead
apiClient.post('/leads/{id}/assign', { assigned_to })      // Assign lead (admin only)
```

### Tracking (✅ Migrated)
```javascript
apiClient.get('/tracking/my-sheets')         // Get active tracking sheets
apiClient.get('/tracking/my-leads')          // Get assigned leads
apiClient.get('/tracking/my-leads?status=contacted')  // Filter by status
apiClient.patch('/tracking/leads/{id}', data) // Update lead (status, notes, dates, etc.)
```

### Users
```javascript
apiClient.getUsers()
apiClient.createUser(data)
```

### EOD Reports (✅ Migrated)
```javascript
apiClient.post('/eod/submit', { report_date, rating, pool_key, question_answers, tasks })  // Submit EOD report
apiClient.get('/eod/today')                                                // Get today's report
apiClient.get('/eod/my-reports?limit=10&offset=0')                        // Get my EOD history
apiClient.get('/eod/team-reports?date=2026-02-08')                        // Get team reports (admin only)
```

---

## Migration Status

| Component/Page | Uses apiClient | Uses Supabase | Status |
|----------------|----------------|---------------|--------|
| Login | ✅ | ❌ | ✅ Done |
| SharedNavbar | ✅ | ⚠️ (session only) | ✅ Done (permissions) |
| Leaderboard | ✅ | ❌ | ✅ Done (protected) |
| TrackingSheet | ✅ | ❌ | ✅ Done |
| LeadsManagement | ✅ | ⚠️ (Info only) | ✅ Done (leads, clients) |
| AdminLeads | ✅ | ❌ | ✅ Done |
| MonitoringPerf | ✅ | ❌ | ✅ Done (UI may need adjustments) |
| EODReport | ✅ | ❌ | ✅ Done |
| EmployeeSales | ❌ | ✅ | ⚠️ TODO |
| ContractNew | ❌ | ❌ | ⚠️ TODO |

---

## Project Structure

```
src/
├── services/
│   └── apiClient.js              # JWT API client
├── routes/
│   └── ProtectedRoute.jsx        # Auth guard
├── pages/
│   ├── Login.jsx                 # JWT login
│   ├── Leaderboard.jsx           # Main dashboard (apiClient ✅)
│   ├── EmployeeSales.jsx         # Employee detail
│   ├── LeadsManagement.jsx       # Lead management
│   ├── AdminLeads.jsx            # Admin analytics
│   ├── TrackingSheet.jsx         # Sales pipeline
│   ├── MonitoringPerf.jsx        # Performance monitoring
│   ├── EODReport.jsx             # End of Day reports
│   └── ContractNew.jsx           # NDA generation (SACRED)
├── components/
│   ├── SharedNavbar.jsx
│   └── MouseDot.jsx
├── utils/
│   └── generateContractPdf.js    # PDF generation
├── contracts/
│   ├── schemas.js
│   └── format.js
├── lib/
│   └── supabaseClient.js         # Keep until full migration
├── supabase.js                   # Keep until full migration
└── main.jsx                      # App entry
```

---

## What Was Removed (Phase 1)

- ❌ Electronic signature flow (Signature.jsx, Contrat.jsx, sendEmail.js)
- ❌ Old Slack OAuth (AuthCallback.jsx)
- ❌ Unused pages (ClientNew.jsx, AssignLeads.jsx)
- ❌ Backup files (*.backup, *.old, test.js)
- ❌ Unused App.jsx

---

## Environment Variables

```bash
# Backend API
VITE_API_URL=https://api.ownertechnology.com

# Webhooks (n8n)
VITE_N8N_SALES_WEBHOOK_URL=https://n8nmay.xyz/webhook/...
VITE_N8N_EOD_WEBHOOK_URL=https://n8nmay.xyz/webhook/...

# Supabase (keep until full migration)
VITE_SUPABASE_URL=https://rqadrfwwqoqqigzravkt.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

---

## Development

```bash
npm install --legacy-peer-deps
npm run dev      # http://localhost:5173
npm run build
```

---

## Test Credentials

**Admin**
- Email: `y.amrane@ownertechnology.com`
- Password: `Welcome123`
- Role: `admin`
- Access: Full (all pages)
- Status: ✅ Verified in database

**Admin (Test)**
- Email: `admin@test.com`
- Password: `[Ask backend agent]`
- Role: `admin`
- Access: Full (all pages)
- Status: ✅ Exists in database

**Note**: Commercial user credentials need to be created by backend agent

---

## Key Workflows

### Sales Declaration (NDA) - SACRED
1. Leaderboard → "Générer le NDA" button
2. Navigate to `/contracts/new`
3. Fill NDA form (company info, employee range)
4. Generate PDF
5. Webhook to n8n for processing

### Employee Detail
1. Leaderboard → Click sales name
2. Navigate to `/employee/:name`
3. View individual sales stats

### Lead Assignment
1. LeadsManagement → Select lead
2. Assign to sales rep
3. Sales rep sees in TrackingSheet

---

## Backend System

**Stack**: FastAPI + PostgreSQL (Supabase) + JWT (bcrypt + python-jose)
**Host**: Hostinger (Docker: `api-owner` container)
**URL**: `https://api.ownertechnology.com`

### Auth Implementation ✅
- Password hashing: bcrypt (12 rounds)
- JWT algorithm: HS256
- Token expiration: 8 hours (480 minutes)
- Email normalization: `email.strip().lower()`
- Protected routes: Automatic 401 redirect on invalid/expired token

### Frontend Integration ✅
1. Login: `POST /api/v1/auth/login` → Returns `{access_token, user, permissions}`
2. Storage: Token in `localStorage` as `"auth_token"`
3. Requests: All include `Authorization: Bearer ${token}` header
4. Validation: `GET /api/v1/auth/me` to verify token
5. Error handling: 401 → auto-logout + redirect to `/login`

### Role-Based Permissions ✅
Backend sends permissions in login response based on `role_permissions` table:
```json
{
  "permissions": {
    "leaderboard": true,
    "admin_leads": true,
    "leads_management": false,
    "tracking_sheet": false,
    "monitoring_perf": true
  }
}
```

**Frontend Implementation** ([SharedNavbar.jsx](src/components/SharedNavbar.jsx)):
- Navigation items dynamically shown/hidden using `apiClient.hasAccess(pageKey)`
- Admin users (role='admin') have access to all pages automatically
- Other roles respect permissions from backend
- No more hardcoded email checks

**Permission Keys**:
- `leaderboard` → Suivi des ventes (/)
- `admin_leads` → Monitoring (/admin/leads)
- `leads_management` → Gestion des Leads (/leads-management)
- `monitoring_perf` → Monitoring Perf (/monitoring-perf)
- `tracking_sheet` → Tracking Sheet (/tracking-sheet)
- `eod_reports` → End of Day (/eod-report)

### Backend Endpoints

#### Implemented ✅
- `POST /api/v1/auth/login` - Login with email/password
- `GET /api/v1/auth/me` - Get current user + permissions
- `GET /api/v1/leaderboard/stats` - Leaderboard statistics
- `GET /api/v1/leaderboard/chart` - Chart data
- `GET /api/v1/tracking/my-sheets` - Get tracking sheets
- `GET /api/v1/tracking/my-leads` - Get assigned leads (with filters)
- `PATCH /api/v1/tracking/leads/{id}` - Update lead
- `GET /api/v1/leads` - List all leads (pagination, search, filters)
- `PATCH /api/v1/leads/{id}` - Update lead
- `POST /api/v1/leads/{id}/assign` - Assign lead to user (admin only)
- `GET /api/v1/clients` - List all clients (pagination, search)
- `GET /api/v1/admin/leads/stats` - AdminLeads analytics dashboard
- `GET /api/v1/monitoring/performance` - Performance stats (sales, calls, EOD metrics)
- `GET /api/v1/users` - List users (admin)
- `POST /api/v1/users` - Create user (admin)
- `POST /api/v1/eod/submit` - Submit/update EOD report
- `GET /api/v1/eod/today` - Get today's EOD report
- `GET /api/v1/eod/my-reports` - Get my EOD history (paginated)
- `GET /api/v1/eod/team-reports` - Get team EOD reports by date (admin only)

#### Needed ⚠️
- `GET /api/v1/employees/{name}/sales` - Employee sales for EmployeeSales page
- `POST /api/v1/contracts` - Create contract (low priority)

---

## Notes

- **Leaderboard requires auth** - Redirects to /login if no JWT
- **TrackingSheet fully migrated** - Now uses backend API for all operations
- **LeadsManagement fully migrated** - Uses backend API for leads and clients (only Info table still on Supabase)
- **AdminLeads fully migrated** - Now uses backend API stats endpoint
- **MonitoringPerf migrated** - Now uses backend API `/monitoring/performance` (UI may need adjustments to match new data structure)
- **Progressive migration**: Supabase → apiClient (one page at a time)
- **Do not delete** Supabase clients until all pages migrated
- **NDA/Sales declarations are untouchable** - core business
- **EmployeeSales** required for employee detail view from Leaderboard
