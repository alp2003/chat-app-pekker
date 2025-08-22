# Enterprise Authentication Pattern - Proper Flow

This document shows the **correct enterprise approach** for handling user operations in a chat
service without fallback user creation.

## ✅ Best Practice: Validation-First Approach

### Key Principles

- **Validate users exist** before any operations
- **No automatic user creation** with hardcoded credentials
- **Clear error messages** that guide the client
- **Proper exception handling** with descriptive feedback

## Code Examples

### 1. Save Message with User Validation

```typescript
@Injectable()
export class ChatService {
  async saveMessage(input: { roomId: string; senderId: string; content: string }) {
    // DON'T create user - validate they exist
    const userExists = await this.prisma.user.findUnique({
      where: { id: input.senderId },
      select: { id: true },
    });

    if (!userExists) {
      throw new BadRequestException(
        `User ${input.senderId} not found. User must be registered first.`
      );
    }

    // Now safely save message
    return this.prisma.message.create({
      data: {
        roomId: input.roomId,
        senderId: input.senderId,
        content: input.content,
      },
    });
  }
}
```

### 2. Add Members with Bulk Validation

```typescript
async addMembers(roomId: string, userIds: string[]) {
  // Validate ALL users exist first
  const existingUsers = await this.prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true }
  });

  const missingUsers = userIds.filter(id =>
    !existingUsers.find(user => user.id === id)
  );

  if (missingUsers.length > 0) {
    throw new BadRequestException(
      `Users not found: ${missingUsers.join(', ')}. Users must be registered first.`
    );
  }

  // Now safely create memberships
  return this.prisma.membership.createMany({
    data: userIds.map(userId => ({ userId, roomId, role: 'member' })),
    skipDuplicates: true,
  });
}
```

## ❌ Anti-Pattern to Avoid

```typescript
// DON'T DO THIS - Security Risk!
async ensureUser(userId: string, username?: string) {
  let user = await this.prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    // Creating users with hardcoded passwords is a security risk
    user = await this.prisma.user.create({
      data: {
        id: userId,
        username: username || `user_${userId.slice(0, 8)}`,
        password: 'temp_password_123', // ❌ Hardcoded password!
      }
    });
  }

  return user;
}
```

## 🔒 Security Benefits

1. **No Hardcoded Credentials**: Users must be properly registered through AuthService
2. **Clear Boundaries**: Chat operations are separate from user registration
3. **Explicit Validation**: Makes it obvious when users don't exist
4. **Better Error Handling**: Clients know exactly what went wrong and how to fix it

## Implementation Notes

- Users must be created through proper registration flow (AuthService)
- Chat operations validate users exist but never create them
- WebSocket connections also validate user existence
- All validation methods are reusable across different operations

---

This pattern ensures enterprise-grade security by maintaining strict boundaries between
authentication and business logic.
