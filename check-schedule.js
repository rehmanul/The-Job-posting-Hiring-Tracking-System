import fetch from 'node-fetch';

const API_BASE = 'https://boostkit-jobtracker.duckdns.org';

async function checkScheduleStatus() {
  try {
    console.log('🔍 Checking Job Tracker Schedule Status...\n');
    
    const response = await fetch(`${API_BASE}/api/system/schedule`);
    const data = await response.json();
    
    if (data.isRunning) {
      console.log('✅ Tracking System: RUNNING');
      console.log('\n📅 Cron Jobs Status:');
      
      Object.entries(data.cronJobs).forEach(([key, job]) => {
        const status = job.active ? '✅ ACTIVE' : '❌ INACTIVE';
        console.log(`   ${key}: ${status}`);
        console.log(`      Schedule: ${job.schedule}`);
        console.log(`      Description: ${job.description}\n`);
      });
      
      console.log('⏰ Next Scheduled Runs:');
      Object.entries(data.nextRuns).forEach(([key, time]) => {
        const nextRun = new Date(time);
        console.log(`   ${key}: ${nextRun.toLocaleString()}`);
      });
      
    } else {
      console.log('❌ Tracking System: NOT RUNNING');
    }
    
  } catch (error) {
    console.error('❌ Error checking schedule status:', error.message);
    console.log('\n💡 Make sure your server is running at:', API_BASE);
  }
}

checkScheduleStatus();