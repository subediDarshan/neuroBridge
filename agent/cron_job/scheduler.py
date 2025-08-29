import schedule
import threading
import time
from workflow.diagnose import trend_analysis_workflow
from workflow.periodic_wellness_check import periodic_workflow

class WorkflowScheduler:
    def __init__(self):
        self.running = True
        self.scheduler_thread = None

    def run_diagnose_workflow(self):
        """Run diagnose workflow with error handling"""
        try:
            print("🔍 Starting diagnose workflow...")
            result = trend_analysis_workflow.invoke({})
            print(f"✅ Diagnose workflow completed: {result.get('status', 'unknown')}")
        except Exception as e:
            print(f"❌ Diagnose workflow failed: {e}")

    def run_periodic_wellness_workflow(self):
        """Run periodic wellness workflow with error handling"""
        try:
            print("💪 Starting periodic wellness check...")
            result = periodic_workflow.invoke({})
            print(f"✅ Periodic wellness check completed: {result.get('status', 'unknown')}")
        except Exception as e:
            print(f"❌ Periodic wellness check failed: {e}")

    def setup_schedules(self):
        """Setup the scheduled jobs"""
        # Schedule diagnose workflow every 3 minutes
        schedule.every(3).minutes.do(self.run_diagnose_workflow)
        print("📅 Diagnose workflow scheduled (every 3 minutes)")
        
        # Schedule periodic wellness workflow every 2 minutes  
        schedule.every(2).minutes.do(self.run_periodic_wellness_workflow)
        print("📅 Periodic wellness workflow scheduled (every 2 minutes)")

    def run_scheduler(self):
        """Run the scheduler in a loop"""
        while self.running:
            schedule.run_pending()
            time.sleep(1)  # Check every second

    def start(self):
        """Start the workflow scheduler"""
        self.setup_schedules()
        
        # Run scheduler in a separate daemon thread
        self.scheduler_thread = threading.Thread(target=self.run_scheduler, daemon=True, name="WorkflowScheduler")
        self.scheduler_thread.start()
        
        print("🚀 Workflow scheduler started!")

    def stop(self):
        """Stop the workflow scheduler"""
        print("🛑 Stopping workflow scheduler...")
        self.running = False
        
        # Clear all scheduled jobs
        schedule.clear()
        
        if self.scheduler_thread and self.scheduler_thread.is_alive():
            self.scheduler_thread.join(timeout=2)
        
        print("✅ Workflow scheduler stopped")

    def get_scheduled_jobs(self):
        """Print all scheduled jobs"""
        jobs = schedule.get_jobs()
        if jobs:
            print("📋 Scheduled Jobs:")
            for job in jobs:
                print(f"  - {job}")
        else:
            print("📋 No scheduled jobs")

# Global scheduler instance
workflow_scheduler = WorkflowScheduler()

def start_schedulers():
    """Start the workflow schedulers"""
    workflow_scheduler.start()

def stop_schedulers():
    """Stop the workflow schedulers"""
    workflow_scheduler.stop()

def show_scheduled_jobs():
    """Show all scheduled jobs"""
    workflow_scheduler.get_scheduled_jobs()