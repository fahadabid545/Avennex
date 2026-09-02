import os
import sys

from supabase import create_client
import bcrypt


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    email = os.environ.get("ADMIN_EMAIL")
    password = os.environ.get("ADMIN_PASSWORD")

    if not all([url, key, email, password]):
        print("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD")
        sys.exit(1)

    db = create_client(url, key)

    existing = db.table("admins").select("id").eq("email", email).execute()
    if existing.data:
        print(f"Admin {email} already exists, skipping.")
        return

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    db.table("admins").insert({
        "email": email,
        "password_hash": password_hash,
        "name": "Admin",
    }).execute()

    print(f"Admin {email} created.")


if __name__ == "__main__":
    main()
