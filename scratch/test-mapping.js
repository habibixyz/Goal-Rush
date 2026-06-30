// Test the mapped status logic directly with different input statusTypes
function getStatus(statusType, dateStr) {
  let status = 'SCHEDULED';
  if (statusType === 'STATUS_IN_PROGRESS' || statusType.includes('HALF') || statusType.includes('HALFTIME') || statusType.includes('PROGRESS')) {
    status = 'LIVE';
  } else if (statusType === 'STATUS_FULL_TIME' || statusType.startsWith('STATUS_FINAL') || statusType === 'STATUS_FT') {
    status = 'FINISHED';
  } else if (statusType === 'STATUS_POSTPONED' || statusType === 'STATUS_CANCELED') {
    status = 'POSTPONED';
  }

  // Check if kickoff is within 5 minutes (or has passed) and match is scheduled/in progress on ESPN
  const kickoffMs = new Date(dateStr).getTime();
  const nowMs = Date.now();
  if (status === 'SCHEDULED' && kickoffMs - nowMs <= 5 * 60 * 1000) {
    status = 'LIVE';
  }

  return status;
}

const testCases = [
  { statusType: 'STATUS_IN_PROGRESS', date: new Date(Date.now() - 3600*1000).toISOString(), expected: 'LIVE' },
  { statusType: 'STATUS_FINAL_PEN', date: new Date(Date.now() - 7200*1000).toISOString(), expected: 'FINISHED' },
  { statusType: 'STATUS_FINAL_AET', date: new Date(Date.now() - 7200*1000).toISOString(), expected: 'FINISHED' },
  { statusType: 'STATUS_FULL_TIME', date: new Date(Date.now() - 7200*1000).toISOString(), expected: 'FINISHED' },
  { statusType: 'STATUS_SCHEDULED', date: new Date(Date.now() + 3600*1000).toISOString(), expected: 'SCHEDULED' },
  { statusType: 'STATUS_SCHEDULED', date: new Date(Date.now() - 300*1000).toISOString(), expected: 'LIVE' }, // Past start time with scheduled status -> LIVE
];

let success = true;
for (const tc of testCases) {
  const got = getStatus(tc.statusType, tc.date);
  if (got !== tc.expected) {
    console.error(`FAIL: For ${tc.statusType} (date: ${tc.date}), expected ${tc.expected}, got ${got}`);
    success = false;
  } else {
    console.log(`PASS: For ${tc.statusType} -> ${got}`);
  }
}

if (success) {
  console.log("All status mapping test cases passed!");
} else {
  process.exit(1);
}
