"""Exercise keyboard SIGINT through a real POSIX terminal, before any network call."""

import errno
import os
import pty
import select
import signal
import sys
import time

pid, terminal = pty.fork()
if pid == 0:
    os.execvpe(sys.argv[1], sys.argv[1:], os.environ)

output = b""
sent = False
status = None
try:
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if select.select([terminal], [], [], 0.05)[0]:
            try:
                output += os.read(terminal, 65536)
            except OSError as error:
                if error.errno == errno.EIO:
                    break
                raise
        if not sent and b"Authorize this CLI device:" in output:
            os.write(terminal, b"\x03")
            sent = True
        done, result = os.waitpid(pid, os.WNOHANG)
        if done:
            status = result
            break
finally:
    if status is None:
        done, status = os.waitpid(pid, os.WNOHANG)
        if not done:
            os.kill(pid, signal.SIGKILL)
            status = os.waitpid(pid, 0)[1]
    os.close(terminal)

assert os.waitstatus_to_exitcode(status) == 130, output.decode(errors="replace")
assert b"CANCELLED: Request cancelled." in output, output
assert b"REQUEST_FAILED" not in output, output
print("Keyboard cancellation passed: exit 130, no network-error message")
