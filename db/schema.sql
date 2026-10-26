PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS user(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,emailVerified INTEGER NOT NULL DEFAULT 0,image TEXT,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS session(id TEXT PRIMARY KEY,expiresAt INTEGER NOT NULL,token TEXT NOT NULL UNIQUE,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL,ipAddress TEXT,userAgent TEXT,userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS session_user_idx ON session(userId);
CREATE TABLE IF NOT EXISTS account(id TEXT PRIMARY KEY,accountId TEXT NOT NULL,providerId TEXT NOT NULL,userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,accessToken TEXT,refreshToken TEXT,idToken TEXT,accessTokenExpiresAt INTEGER,refreshTokenExpiresAt INTEGER,scope TEXT,password TEXT,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS account_user_idx ON account(userId);
CREATE TABLE IF NOT EXISTS verification(id TEXT PRIMARY KEY,identifier TEXT NOT NULL,value TEXT NOT NULL,expiresAt INTEGER NOT NULL,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);
CREATE TABLE IF NOT EXISTS rateLimit(id TEXT PRIMARY KEY,key TEXT NOT NULL UNIQUE,count INTEGER NOT NULL,lastRequest INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings(user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,analyze_on_add INTEGER NOT NULL DEFAULT 1,daily_checks_enabled INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS connections(owner_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,github_id TEXT NOT NULL,credential TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS repositories(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,github_id INTEGER NOT NULL,url TEXT NOT NULL,name TEXT NOT NULL,private INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(owner_id,github_id),UNIQUE(id,owner_id));
CREATE TABLE IF NOT EXISTS analyses(repository_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,snapshot TEXT,last_success_at TEXT,latest_status TEXT NOT NULL DEFAULT 'idle',latest_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reason TEXT,lease_id TEXT,lease_until INTEGER,FOREIGN KEY(repository_id,owner_id) REFERENCES repositories(id,owner_id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS checks(response_format TEXT NOT NULL DEFAULT 'default' CHECK(response_format IN ('default','json','text','html')),id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,repository_id TEXT NOT NULL,label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 100),url TEXT NOT NULL,auth_type TEXT NOT NULL CHECK(auth_type IN ('none','bearer','header')),header_name TEXT,credential TEXT,expected_code INTEGER CHECK(expected_code BETWEEN 100 AND 599),json_path TEXT,expected_value TEXT,enabled INTEGER NOT NULL DEFAULT 1,latest_result TEXT,lease_id TEXT,lease_until INTEGER,last_manual_at INTEGER,last_claimed_day TEXT,FOREIGN KEY(repository_id,owner_id) REFERENCES repositories(id,owner_id) ON DELETE CASCADE,CHECK((auth_type='none' AND credential IS NULL) OR (auth_type!='none' AND credential IS NOT NULL)));
CREATE INDEX IF NOT EXISTS repositories_owner ON repositories(owner_id);
CREATE INDEX IF NOT EXISTS checks_owner ON checks(owner_id);
CREATE INDEX IF NOT EXISTS checks_repository ON checks(repository_id);
CREATE TRIGGER IF NOT EXISTS check_limits BEFORE INSERT ON checks BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM checks)>=20 THEN RAISE(ABORT,'CHECK_GLOBAL_LIMIT') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM checks WHERE owner_id=NEW.owner_id)>=5 THEN RAISE(ABORT,'CHECK_USER_LIMIT') END;
END;

CREATE TABLE IF NOT EXISTS analysis_progress(repository_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,run_id TEXT NOT NULL,stage TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,total INTEGER,updated_at TEXT NOT NULL,FOREIGN KEY(repository_id,owner_id) REFERENCES repositories(id,owner_id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS project_probes(response_format TEXT NOT NULL DEFAULT 'default' CHECK(response_format IN ('default','json','text','html')),repository_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,deployment_url TEXT,auth_type TEXT NOT NULL DEFAULT 'none' CHECK(auth_type IN ('none','bearer','header')),header_name TEXT,credential TEXT,auto_enabled INTEGER NOT NULL DEFAULT 1,revision TEXT NOT NULL,latest_result TEXT,lease_id TEXT,lease_until INTEGER,last_run_at INTEGER,last_error TEXT,FOREIGN KEY(repository_id,owner_id) REFERENCES repositories(id,owner_id) ON DELETE CASCADE,CHECK((auth_type='none' AND credential IS NULL) OR (auth_type!='none' AND credential IS NOT NULL)));
CREATE INDEX IF NOT EXISTS project_probes_owner_run ON project_probes(owner_id,last_run_at);
CREATE INDEX IF NOT EXISTS project_probes_lease ON project_probes(lease_until);
