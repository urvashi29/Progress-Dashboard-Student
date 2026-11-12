export type AuthRole = 'student' | 'admin'

export type AuthContext = {
  studentId: number
  email: string
  name: string
  role: AuthRole
  mustChangePassword: boolean
}
