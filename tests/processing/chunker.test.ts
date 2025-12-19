/**
 * Comprehensive tests for chunking logic
 * Tests symbol extraction, boundary detection, and metadata generation
 */

import { describe, it, expect } from 'bun:test';
import { chunkCode } from '../../src/processing/chunker.js';

describe('Chunker - TypeScript/JavaScript', () => {
  it('should extract function symbols', () => {
    const code = `
export function authenticate(credentials: any) {
  return validateCredentials(credentials);
}

function validateCredentials(creds: any) {
  return creds.valid;
}
`;
    const chunks = chunkCode(code, 'typescript', 200);

    expect(chunks.length).toBeGreaterThan(0);

    const authChunk = chunks.find(c => c.metadata?.symbolName === 'authenticate');
    expect(authChunk).toBeDefined();
    expect(authChunk?.metadata?.symbolType).toBe('function');
    expect(authChunk?.metadata?.isDefinition).toBe(true);

    const validateChunk = chunks.find(c => c.metadata?.symbolName === 'validateCredentials');
    expect(validateChunk).toBeDefined();
    expect(validateChunk?.metadata?.symbolType).toBe('function');
  });

  it('should extract class symbols', () => {
    const code = `
export class UserService {
  async authenticate(credentials: any) {
    return true;
  }

  async createUser(data: any) {
    return { id: 1 };
  }
}
`;
    const chunks = chunkCode(code, 'typescript', 200);

    const classChunk = chunks.find(c => c.metadata?.symbolName === 'UserService');
    expect(classChunk).toBeDefined();
    expect(classChunk?.metadata?.symbolType).toBe('class');
    expect(classChunk?.metadata?.isDefinition).toBe(true);

    const authMethod = chunks.find(c => c.metadata?.symbolName === 'authenticate');
    expect(authMethod).toBeDefined();
    expect(authMethod?.metadata?.symbolType).toBe('method');
  });

  it('should extract interface symbols', () => {
    const code = `
export interface User {
  id: number;
  name: string;
}

interface Credentials {
  username: string;
  password: string;
}
`;
    const chunks = chunkCode(code, 'typescript', 200);

    const userInterface = chunks.find(c => c.metadata?.symbolName === 'User');
    expect(userInterface).toBeDefined();
    expect(userInterface?.metadata?.symbolType).toBe('interface');

    const credInterface = chunks.find(c => c.metadata?.symbolName === 'Credentials');
    expect(credInterface).toBeDefined();
  });

  it('should extract type aliases', () => {
    const code = `
export type UserId = string;
type UserRole = 'admin' | 'user';
`;
    const chunks = chunkCode(code, 'typescript', 200);

    const userIdType = chunks.find(c => c.metadata?.symbolName === 'UserId');
    expect(userIdType).toBeDefined();
    expect(userIdType?.metadata?.symbolType).toBe('type');
  });

  it('should track line numbers correctly', () => {
    const code = `// Line 1
function first() {
  return 1;
}

function second() {
  return 2;
}`;
    const chunks = chunkCode(code, 'typescript', 200);

    const firstChunk = chunks.find(c => c.metadata?.symbolName === 'first');
    expect(firstChunk?.startLine).toBe(2);
    expect(firstChunk?.endLine).toBeGreaterThanOrEqual(2);

    const secondChunk = chunks.find(c => c.metadata?.symbolName === 'second');
    expect(secondChunk?.startLine).toBe(6);
  });

  it('should handle overlap tokens', () => {
    const code = 'a'.repeat(1000); // Large content
    const chunks = chunkCode(code, 'typescript', 100);

    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should have some overlap with previous
    if (chunks.length > 1) {
      expect(chunks[1].content.length).toBeGreaterThan(0);
    }
  });
});

describe('Chunker - Python', () => {
  it('should extract function symbols', () => {
    const code = `
def authenticate(credentials):
    return validate_credentials(credentials)

def validate_credentials(creds):
    return creds.get('valid', False)
`;
    const chunks = chunkCode(code, 'python', 200);

    const authChunk = chunks.find(c => c.metadata?.symbolName === 'authenticate');
    expect(authChunk).toBeDefined();
    expect(authChunk?.metadata?.symbolType).toBe('function');

    const validateChunk = chunks.find(c => c.metadata?.symbolName === 'validate_credentials');
    expect(validateChunk).toBeDefined();
  });

  it('should extract class symbols', () => {
    const code = `
class UserService:
    def authenticate(self, credentials):
        return True

    def create_user(self, data):
        return {'id': 1}
`;
    const chunks = chunkCode(code, 'python', 200);

    const classChunk = chunks.find(c => c.metadata?.symbolName === 'UserService');
    expect(classChunk).toBeDefined();
    expect(classChunk?.metadata?.symbolType).toBe('class');

    const authMethod = chunks.find(c => c.metadata?.symbolName === 'authenticate');
    expect(authMethod).toBeDefined();
  });

  it('should handle decorators', () => {
    const code = `
@app.route('/api/users')
def get_users():
    return []
`;
    const chunks = chunkCode(code, 'python', 200);

    const funcChunk = chunks.find(c => c.metadata?.symbolName === 'get_users');
    expect(funcChunk).toBeDefined();
  });
});

describe('Chunker - Java', () => {
  it('should extract class symbols', () => {
    const code = `
public class UserService {
    public User authenticate(Credentials credentials) {
        return validateCredentials(credentials);
    }

    private User validateCredentials(Credentials creds) {
        return null;
    }
}
`;
    const chunks = chunkCode(code, 'java', 200);

    const classChunk = chunks.find(c => c.metadata?.symbolName === 'UserService');
    expect(classChunk).toBeDefined();
    expect(classChunk?.metadata?.symbolType).toBe('class');
  });

  it('should extract interface symbols', () => {
    const code = `
public interface AuthService {
    User authenticate(Credentials credentials);
    void logout(String userId);
}
`;
    const chunks = chunkCode(code, 'java', 200);

    const interfaceChunk = chunks.find(c => c.metadata?.symbolName === 'AuthService');
    expect(interfaceChunk).toBeDefined();
    expect(interfaceChunk?.metadata?.symbolType).toBe('interface');
  });
});

describe('Chunker - Go', () => {
  it('should extract function symbols', () => {
    const code = `
func Authenticate(credentials Credentials) (*User, error) {
    return validateCredentials(credentials)
}

func validateCredentials(creds Credentials) (*User, error) {
    return nil, nil
}
`;
    const chunks = chunkCode(code, 'go', 200);

    const authChunk = chunks.find(c => c.metadata?.symbolName === 'Authenticate');
    expect(authChunk).toBeDefined();
    expect(authChunk?.metadata?.symbolType).toBe('function');
  });

  it('should extract struct symbols', () => {
    const code = `
type User struct {
    ID   string
    Name string
}

type Credentials struct {
    Username string
    Password string
}
`;
    const chunks = chunkCode(code, 'go', 200);

    const userStruct = chunks.find(c => c.metadata?.symbolName === 'User');
    expect(userStruct).toBeDefined();
    expect(userStruct?.metadata?.symbolType).toBe('struct');
  });

  it('should extract interface symbols', () => {
    const code = `
type AuthService interface {
    Authenticate(credentials Credentials) (*User, error)
    Logout(userID string) error
}
`;
    const chunks = chunkCode(code, 'go', 200);

    const interfaceChunk = chunks.find(c => c.metadata?.symbolName === 'AuthService');
    expect(interfaceChunk).toBeDefined();
    expect(interfaceChunk?.metadata?.symbolType).toBe('interface');
  });
});

describe('Chunker - Rust', () => {
  it('should extract function symbols', () => {
    const code = `
pub fn authenticate(credentials: Credentials) -> Result<User, Error> {
    validate_credentials(credentials)
}

fn validate_credentials(creds: Credentials) -> Result<User, Error> {
    Ok(User::default())
}
`;
    const chunks = chunkCode(code, 'rust', 200);

    const authChunk = chunks.find(c => c.metadata?.symbolName === 'authenticate');
    expect(authChunk).toBeDefined();
    expect(authChunk?.metadata?.symbolType).toBe('function');
  });

  it('should extract struct symbols', () => {
    const code = `
pub struct User {
    pub id: String,
    pub name: String,
}

struct Credentials {
    username: String,
    password: String,
}
`;
    const chunks = chunkCode(code, 'rust', 200);

    const userStruct = chunks.find(c => c.metadata?.symbolName === 'User');
    expect(userStruct).toBeDefined();
    expect(userStruct?.metadata?.symbolType).toBe('struct');
  });

  it('should extract trait symbols', () => {
    const code = `
pub trait AuthService {
    fn authenticate(&self, credentials: Credentials) -> Result<User, Error>;
    fn logout(&self, user_id: &str) -> Result<(), Error>;
}
`;
    const chunks = chunkCode(code, 'rust', 200);

    const traitChunk = chunks.find(c => c.metadata?.symbolName === 'AuthService');
    expect(traitChunk).toBeDefined();
    expect(traitChunk?.metadata?.symbolType).toBe('trait');
  });

  it('should extract impl blocks', () => {
    const code = `
impl User {
    pub fn new(id: String, name: String) -> Self {
        User { id, name }
    }
}
`;
    const chunks = chunkCode(code, 'rust', 200);

    const implChunk = chunks.find(c => c.metadata?.symbolName === 'User');
    expect(implChunk).toBeDefined();
    expect(implChunk?.metadata?.symbolType).toBe('impl');
  });
});

describe('Chunker - Edge Cases', () => {
  it('should handle empty code', () => {
    const chunks = chunkCode('', 'typescript', 200);
    expect(chunks.length).toBe(0);
  });

  it('should handle code with no symbols', () => {
    const code = '// Just a comment\nconst x = 1;';
    const chunks = chunkCode(code, 'typescript', 200);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle very large files', () => {
    const code = 'a'.repeat(100000);
    const chunks = chunkCode(code, 'typescript', 500);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle nested structures', () => {
    const code = `
class Outer {
  class Inner {
    function deep() {
      return true;
    }
  }
}
`;
    const chunks = chunkCode(code, 'typescript', 200);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle unicode and special characters', () => {
    const code = `
function greet(名前: string) {
  return \`こんにちは、\${名前}さん\`;
}
`;
    const chunks = chunkCode(code, 'typescript', 200);
    const greetChunk = chunks.find(c => c.metadata?.symbolName === 'greet');
    expect(greetChunk).toBeDefined();
  });

  it('should preserve chunk order', () => {
    const code = `
function first() {}
function second() {}
function third() {}
`;
    const chunks = chunkCode(code, 'typescript', 200);

    const firstIdx = chunks.findIndex(c => c.metadata?.symbolName === 'first');
    const secondIdx = chunks.findIndex(c => c.metadata?.symbolName === 'second');
    const thirdIdx = chunks.findIndex(c => c.metadata?.symbolName === 'third');

    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  it('should include chunk indices', () => {
    const code = 'a'.repeat(1000);
    const chunks = chunkCode(code, 'typescript', 100);

    chunks.forEach((chunk, idx) => {
      expect(chunk.chunkIndex).toBe(idx);
    });
  });

  it('should handle code with mixed line endings', () => {
    const code = 'function test() {\r\n  return true;\r\n}';
    const chunks = chunkCode(code, 'typescript', 200);
    expect(chunks.length).toBeGreaterThan(0);
  });
});
