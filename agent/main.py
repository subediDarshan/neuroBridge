from sockets.client import connect_to_server
from config.db import init_db

if __name__ == "__main__":
    print("🚀 Starting app...")

    # Initialize DB
    db = init_db()
    print("📦 Connected to MongoDB:", db.name)

    # Connect to Socket.IO server
    connect_to_server()
