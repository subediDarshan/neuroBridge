from sockets.client import connect_to_server
from config.db import init_db
from cron_job.scheduler import start_schedulers, stop_schedulers, show_scheduled_jobs
import signal
import sys

def signal_handler(sig, frame):
    """Handle graceful shutdown on Ctrl+C"""
    print('\n🛑 Shutting down gracefully...')
    stop_schedulers()
    sys.exit(0)

if __name__ == "__main__":
    print("🚀 Starting app...")

    # Set up signal handler for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)

    # Initialize DB
    db = init_db()
    print("📦 Connected to MongoDB:", db.name)

    # Start workflow schedulers
    start_schedulers()
    
    # Show what's scheduled (optional)
    show_scheduled_jobs()

    # Connect to Socket.IO server (this will block)
    try:
        connect_to_server()
    except KeyboardInterrupt:
        print("🛑 Received interrupt signal")
        stop_schedulers()
        sys.exit(0)