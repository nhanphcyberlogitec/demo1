import bcrypt
import database


def seed():
    conn = database.get_connection()
    cur = conn.cursor()

    # Create users table if it doesn't exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    # Insert admin user if not already present
    email = "admin@example.com"
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    existing = cur.fetchone()

    if not existing:
        password = "password123"
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cur.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
            ("Admin", email, password_hash)
        )
        print(f"Seeded user: {email}")
    else:
        print(f"User {email} already exists, skipping.")

    conn.commit()
    cur.close()
    conn.close()


if __name__ == "__main__":
    seed()
