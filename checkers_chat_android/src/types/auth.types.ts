export interface User {
  _id: string;
  email: string;
  name: string;
  contactNumber: number;
  role: String;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}