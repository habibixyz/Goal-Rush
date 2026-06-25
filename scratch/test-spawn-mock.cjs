const cp = require('child_process');

const originalSpawn = cp.spawn;
cp.spawn = function(command, args, options) {
  if (command === 'ps') {
    const { Readable } = require('stream');
    const mockProcess = new (require('events').EventEmitter)();
    mockProcess.stdout = Readable.from(['123456\n']);
    mockProcess.stderr = Readable.from([]);
    setTimeout(() => {
      mockProcess.emit('close', 0);
    }, 20);
    return mockProcess;
  }
  return originalSpawn.apply(this, arguments);
};

const ps = cp.spawn('ps', ['-o', 'rss']);
let out = '';
ps.stdout.on('data', (data) => { out += data; });
ps.on('close', (code) => {
  console.log(`Exit code: ${code}`);
  console.log(`Output: ${out.trim()}`);
});
