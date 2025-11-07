# 🔧 Fix Azure AD Redirect URI for Vercel Deployment

## 🚨 Problem

**Error**: `AADSTS50011: The redirect URI 'https://marico-insight-safe.vercel.app' specified in the request does not match the redirect URIs configured for the application`

**Root Cause**: Your Vercel deployment URL is not registered as a valid redirect URI in Azure AD.

---

## ✅ Solution: Add Vercel URL to Azure AD

### Step 1: Go to Azure Portal

1. Visit [Azure Portal](https://portal.azure.com)
2. Sign in with your Azure AD account
3. Navigate to **Azure Active Directory** → **App registrations**
4. Find your app: **`5e4faaa4-8f8b-4766-a2d5-d382004beea2`** (or search for "Marico Insight")

### Step 2: Update Authentication Settings

1. **Click on your app registration**
2. **Go to "Authentication"** (in the left sidebar)
3. **Under "Single-page application" section**, you'll see "Redirect URIs"
4. **Click "Add URI"** and add:
   - `https://marico-insight-safe.vercel.app`
   - `https://marico-insight-safe-chiragtalwar-finzarccoms-projects.vercel.app` (alternative URL)
5. **Also add post-logout redirect URI** (if there's a separate field):
   - `https://marico-insight-safe.vercel.app`
6. **Click "Save"** at the top

### Step 3: Verify Configuration

Your Azure AD app should now have these redirect URIs:
- ✅ `http://localhost:3000` (for local development)
- ✅ `https://marico-insight-safe.vercel.app` (for production)
- ✅ `https://marico-insight-safe-chiragtalwar-finzarccoms-projects.vercel.app` (alternative)

**Supported account types**: Should be "Single tenant" or "Multi-tenant"

**Implicit grant and hybrid flows**:
- ✅ Access tokens
- ✅ ID tokens

---

## 🔧 Code Configuration (Already Done)

The code is already configured to use `window.location.origin` dynamically, which means:
- **Local**: Uses `http://localhost:3000`
- **Vercel**: Uses `https://marico-insight-safe.vercel.app`

No code changes needed! Just add the URL to Azure AD.

---

## 🌐 Environment Variables (Optional)

If you want to explicitly set the redirect URI, you can add these to **Vercel Environment Variables**:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `VITE_AZURE_REDIRECT_URI` = `https://marico-insight-safe.vercel.app`
   - `VITE_AZURE_POST_LOGOUT_REDIRECT_URI` = `https://marico-insight-safe.vercel.app`

**Note**: This is optional since the code already uses `window.location.origin` as a fallback.

---

## 🧪 Test After Fix

1. **Wait 1-2 minutes** after saving in Azure AD (propagation time)
2. **Clear browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
3. **Visit**: https://marico-insight-safe.vercel.app
4. **Click "Sign in"**
5. **Should redirect** to Microsoft login (no error!)
6. **Complete authentication**
7. **Should redirect back** to your Vercel app

---

## 📋 Quick Checklist

- [ ] Added `https://marico-insight-safe.vercel.app` to Azure AD redirect URIs
- [ ] Added post-logout redirect URI (if separate field exists)
- [ ] Saved changes in Azure AD
- [ ] Waited 1-2 minutes for propagation
- [ ] Cleared browser cache
- [ ] Tested sign-in flow

---

## 🆘 Still Having Issues?

### If you still see the error:

1. **Check Azure AD**: Make sure the URL is exactly `https://marico-insight-safe.vercel.app` (no trailing slash)
2. **Wait longer**: Azure AD changes can take up to 5 minutes to propagate
3. **Check browser console**: Look for any other errors
4. **Try incognito mode**: To rule out cache issues

### If you need to add a custom domain:

1. **Set up custom domain** in Vercel
2. **Add the custom domain** to Azure AD redirect URIs
3. **Update environment variables** (if using explicit redirect URI)

---

## 📚 Related Documentation

- [Azure AD App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Redirect URI Configuration](https://aka.ms/redirectUriMismatchError)
- [Vercel Custom Domains](https://vercel.com/docs/concepts/projects/domains)

---

**✅ Once you add the Vercel URL to Azure AD, authentication will work perfectly!**

