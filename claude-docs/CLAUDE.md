You are operating in a Node.Js environment in Phusion Passenger 
You do not have root/sudo access in this shared linux VPS server 
You can run nvm and install standard packages that way

Server URL: https://hub.ulearnschool.com/gads/
Main Index: /home/hub/public_html/gads/index.js

On creation, we ran this cPanel instruction for "gads" nodeJS environment: we are in a shared VPS linux Phusion Passenger environment - the node_modules are synlinked to start 

  cPanel instructions "gads" nodeJs environment: Enter to the virtual environment.To enter to virtual environment, run the command: source 
  /home/hub/nodevenv/public_html/gads/20/bin/activate && cd /home/hub/public_html/gads

INDEX & FILE / FOLDER ARCHITECTURE RULES
The index is located at: /home/hub/public_html/gads/index.js 
- CARDINAL RULE: The index should never contain any business logic!! it is for routing/endpoints/authoirzation ONLY!!!
    All business logic goes to the files in /home/hub/public_html/gads/scripts/.../


Basic Instructions
Restart Server: From the gads/ directory the command is: touch tmp/restart.txt
Logs: When I say "read log" or "read the log files" or similar, I mean review the last 50-75lines of /home/hub/public_html/gads/gads.log

COMMANDS
Search commands like "grep" can be run without asking me (non-editing & non-destructive procedure)


GIT
Repo: https://github.com/ulearn/gads
- We are only operating on the claude branch
- Never do anything destructive with git without asking permission

=========================================================================================================

PROJECT SPECIFIC CONTEXT

Read these files:
1) /home/hub/public_html/gads/claude-docs/click-to-close.txt  
2) /home/hub/public_html/gads/claude-docs/claude-mcp-notes
3) MySql Database Schema: /home/hub/public_html/gads/claude-docs/hub_gads_11.09.2025.sql
- Read the schema now to save us the pain of constantly checking which fields it has & their names later during the chat
- And obviously if you have doubts about the field names or schema during the session just refer back to the this .sql file