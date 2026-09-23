# private_uploads

Resumes and chatbot source documents live here. Nothing in it should ever be
served over the web.

On most cPanel accounts this directory sits beside `public_html`, so Apache
never sees it and the `.htaccess` here does nothing. On accounts where the FTP
login lands inside the web root there is nowhere above it to put private files,
and this directory ends up under `public_html` where Apache would serve every
resume at a guessable URL. The `.htaccess` is what stops that.

The backend writes the same file into `private_uploads`, `private_uploads/resumes`
and `private_uploads/chatbot_docs` on every upload, so a fresh install protects
itself. Upload this copy by hand if files were stored before that was true, or
if the server log says a guard could not be written.

Settings, File storage, Check reports which layout the live account has.
