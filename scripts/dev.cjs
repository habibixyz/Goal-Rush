const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting GoalRush Joint Dev Runner (Vite Frontend + Express Backend)...');

// Run backend server
const backend = spawn('node', ['backend/src/server.js'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..')
});

// Run frontend dev server
const frontend = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..')
});

backend.on('close', (code) => {
  console.log(`[BACKEND] Process exited with code ${code}`);
  process.exit(code || 0);
});

frontend.on('close', (code) => {
  console.log(`[FRONTEND] Process exited with code ${code}`);
  process.exit(code || 0);
});

// Handle termination signals to clean up child processes
process.on('SIGINT', () => {
  console.log('\nStopping servers...');
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('\nStopping servers...');
  backend.kill('SIGTERM');
  frontend.kill('SIGTERM');
  process.exit();
});
