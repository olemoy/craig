/**
 * Comprehensive tests for chunking logic
 * Tests symbol extraction, boundary detection, and metadata generation
 */

import { describe, it, expect } from 'bun:test';
import { chunkText } from '../../src/processing/chunker.js';

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
    const chunks = chunkText('test.ts', code, {
      tokenTarget: 200,
      overlapTokens: 20,
      language: 'typescript'
    });

    expect(chunks.length).toBeGreaterThan(0);

    const authChunk = chunks.find(c => c.symbolName === 'authenticate');
    expect(authChunk).toBeDefined();
    expect(authChunk?.symbolType).toBe('function');
    expect(authChunk?.isDefinition).toBe(true);

    const validateChunk = chunks.find(c => c.symbolName === 'validateCredentials');
    expect(validateChunk).toBeDefined();
    expect(validateChunk?.symbolType).toBe('function');
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
    const chunks = chunkText("test.ts", code, { tokenTarget: 200, overlapTokens: 20, language: "typescript" });

    // Chunker extracts the class as a whole chunk
    const classChunk = chunks.find(c => c.symbolName === 'UserService');
    expect(classChunk).toBeDefined();
    expect(classChunk?.symbolType).toBe('class');
    expect(classChunk?.text).toContain('authenticate');
    expect(classChunk?.text).toContain('createUser');
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
    const chunks = chunkText("test.ts", code, { tokenTarget: 200, overlapTokens: 20, language: "typescript" });

    const userInterface = chunks.find(c => c.symbolName === 'User');
    expect(userInterface).toBeDefined();
    expect(userInterface?.symbolType).toBe('interface');

    const credInterface = chunks.find(c => c.symbolName === 'Credentials');
    expect(credInterface).toBeDefined();
  });

  it('should extract type aliases', () => {
    const code = `
export type UserId = string;
type UserRole = 'admin' | 'user';
`;
    const chunks = chunkText("test.ts", code, { tokenTarget: 200, overlapTokens: 20, language: "typescript" });

    const userIdType = chunks.find(c => c.symbolName === 'UserId');
    expect(userIdType).toBeDefined();
    expect(userIdType?.symbolType).toBe('type');
  });

  it('should track line numbers correctly', () => {
    const code = `// Line 1
function first() {
  return 1;
}

function second() {
  return 2;
}`;
    const chunks = chunkText("test.ts", code, { tokenTarget: 200, overlapTokens: 20, language: "typescript" });

    const firstChunk = chunks.find(c => c.symbolName === 'first');
    expect(firstChunk?.startLine).toBe(2);
    expect(firstChunk?.endLine).toBeGreaterThanOrEqual(2);

    const secondChunk = chunks.find(c => c.symbolName === 'second');
    expect(secondChunk?.startLine).toBe(6);
  });

  it('should handle overlap tokens', () => {
    // Create code with multiple functions to ensure chunking with overlap
    const code = Array.from({ length: 15 }, (_, i) => `
function handler${i}(data: any) {
  console.log("Processing item " + data);
  return data;
}
`).join('\n');

    const chunks = chunkText("test.ts", code, { tokenTarget: 100, overlapTokens: 20, language: "typescript" });

    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should have content
    if (chunks.length > 1) {
      expect(chunks[1].text.length).toBeGreaterThan(0);
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
    const chunks = chunkText("test.py", code, { tokenTarget: 200, overlapTokens: 20, language: "python" });

    const authChunk = chunks.find(c => c.symbolName === 'authenticate');
    expect(authChunk).toBeDefined();
    expect(authChunk?.symbolType).toBe('function');

    const validateChunk = chunks.find(c => c.symbolName === 'validate_credentials');
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
    const chunks = chunkText("test.py", code, { tokenTarget: 200, overlapTokens: 20, language: "python" });

    // Chunker extracts the class
    const classChunk = chunks.find(c => c.symbolName === 'UserService');
    expect(classChunk).toBeDefined();
    expect(classChunk?.symbolType).toBe('class');
    expect(classChunk?.text.length).toBeGreaterThan(0);
  });

  it('should handle decorators', () => {
    const code = `
@app.route('/api/users')
def get_users():
    return []
`;
    const chunks = chunkText("test.py", code, { tokenTarget: 200, overlapTokens: 20, language: "python" });

    const funcChunk = chunks.find(c => c.symbolName === 'get_users');
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
    const chunks = chunkText("Test.java", code, { tokenTarget: 200, overlapTokens: 20, language: "java" });

    const classChunk = chunks.find(c => c.symbolName === 'UserService');
    expect(classChunk).toBeDefined();
    expect(classChunk?.symbolType).toBe('class');
  });

  it('should extract interface symbols', () => {
    const code = `
public interface AuthService {
    User authenticate(Credentials credentials);
    void logout(String userId);
}
`;
    const chunks = chunkText("Test.java", code, { tokenTarget: 200, overlapTokens: 20, language: "java" });

    const interfaceChunk = chunks.find(c => c.symbolName === 'AuthService');
    expect(interfaceChunk).toBeDefined();
    expect(interfaceChunk?.symbolType).toBe('interface');
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
    const chunks = chunkText("test.go", code, { tokenTarget: 200, overlapTokens: 20, language: "go" });

    const authChunk = chunks.find(c => c.symbolName === 'Authenticate');
    expect(authChunk).toBeDefined();
    expect(authChunk?.symbolType).toBe('function');
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
    const chunks = chunkText("test.go", code, { tokenTarget: 200, overlapTokens: 20, language: "go" });

    const userStruct = chunks.find(c => c.symbolName === 'User');
    expect(userStruct).toBeDefined();
    expect(userStruct?.symbolType).toBe('struct');
  });

  it('should extract interface symbols', () => {
    const code = `
type AuthService interface {
    Authenticate(credentials Credentials) (*User, error)
    Logout(userID string) error
}
`;
    const chunks = chunkText("test.go", code, { tokenTarget: 200, overlapTokens: 20, language: "go" });

    const interfaceChunk = chunks.find(c => c.symbolName === 'AuthService');
    expect(interfaceChunk).toBeDefined();
    expect(interfaceChunk?.symbolType).toBe('interface');
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
    const chunks = chunkText("test.rs", code, { tokenTarget: 200, overlapTokens: 20, language: "rust" });

    const authChunk = chunks.find(c => c.symbolName === 'authenticate');
    expect(authChunk).toBeDefined();
    expect(authChunk?.symbolType).toBe('function');
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
    const chunks = chunkText("test.rs", code, { tokenTarget: 200, overlapTokens: 20, language: "rust" });

    const userStruct = chunks.find(c => c.symbolName === 'User');
    expect(userStruct).toBeDefined();
    expect(userStruct?.symbolType).toBe('struct');
  });

  it('should extract trait symbols', () => {
    const code = `
pub trait AuthService {
    fn authenticate(&self, credentials: Credentials) -> Result<User, Error>;
    fn logout(&self, user_id: &str) -> Result<(), Error>;
}
`;
    const chunks = chunkText("test.rs", code, { tokenTarget: 200, overlapTokens: 20, language: "rust" });

    const traitChunk = chunks.find(c => c.symbolName === 'AuthService');
    expect(traitChunk).toBeDefined();
    expect(traitChunk?.symbolType).toBe('trait');
  });

  it('should extract impl blocks', () => {
    const code = `
impl User {
    pub fn new(id: String, name: String) -> Self {
        User { id, name }
    }
}
`;
    const chunks = chunkText("test.rs", code, { tokenTarget: 200, overlapTokens: 20, language: "rust" });

    const implChunk = chunks.find(c => c.symbolName === 'User');
    expect(implChunk).toBeDefined();
    expect(implChunk?.symbolType).toBe('impl');
  });
});

describe('Chunker - Edge Cases', () => {
  it('should handle empty code', () => {
    const chunks = chunkText("test.ts", '', { tokenTarget: 200, overlapTokens: 20, language: "typescript" });
    // Empty code still creates one chunk to track the file
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle code with no symbols', () => {
    const code = '// Just a comment\nconst x = 1;';
    const chunks = chunkText("test.ts", code, { tokenTarget: 200, overlapTokens: 20, language: "typescript" });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle very large files', () => {
    // Create a large file with many functions
    const code = Array.from({ length: 100 }, (_, i) => `
export function processData${i}(input: string): string {
  const normalized = input.trim().toLowerCase();
  const validated = normalized.length > 0 ? normalized : "default";
  return validated + "_processed_${i}";
}
`).join('\n');

    const chunks = chunkText("test.ts", code, { tokenTarget: 500, overlapTokens: 20, language: "typescript" });
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
    const chunks = chunkText("test.ts", code, { tokenTarget: 200, overlapTokens: 20, language: "typescript" });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle unicode and special characters', () => {
    const code = `
function greet(名前: string) {
  return \`こんにちは、\${名前}さん\`;
}
`;
    const chunks = chunkText("test.ts", code, { tokenTarget: 200, overlapTokens: 20, language: "typescript" });
    const greetChunk = chunks.find(c => c.symbolName === 'greet');
    expect(greetChunk).toBeDefined();
  });

  it('should preserve chunk order', () => {
    const code = `
function first() {}
function second() {}
function third() {}
`;
    const chunks = chunkText("test.ts", code, { tokenTarget: 200, overlapTokens: 20, language: "typescript" });

    const firstIdx = chunks.findIndex(c => c.symbolName === 'first');
    const secondIdx = chunks.findIndex(c => c.symbolName === 'second');
    const thirdIdx = chunks.findIndex(c => c.symbolName === 'third');

    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  it('should create multiple chunks for large content', () => {
    // Create code with many functions to ensure it exceeds token target
    const functions = Array.from({ length: 20 }, (_, i) => `
function func${i}(param${i}: string) {
  const result = param${i}.toLowerCase();
  return result + " processed";
}
`).join('\n');

    const chunks = chunkText("test.ts", functions, { tokenTarget: 100, overlapTokens: 20, language: "typescript" });

    // Large content should be split into multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle code with mixed line endings', () => {
    const code = 'function test() {\r\n  return true;\r\n}';
    const chunks = chunkText("test.ts", code, { tokenTarget: 200, overlapTokens: 20, language: "typescript" });
    expect(chunks.length).toBeGreaterThan(0);
  });
});
