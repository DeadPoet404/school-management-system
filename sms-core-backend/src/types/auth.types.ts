export interface JwtPayload {
  sub: string;                      // Account UUID
  email: string;                    // Login email
  role: string;                     // STUDENT | STAFF | FACULTY
  entityType: 'STUDENT' | 'STAFF' | 'TEACHER';  // Which account table was matched
  entityInternalId: string;         // Student.id or Staff.id for downstream queries
}
