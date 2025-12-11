import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TestUser {
  id: number;
  username: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class TestService {
  private baseUrl = 'http://localhost:5070/api';

  constructor(private http: HttpClient) {}

  getUsers() {
    return this.http.get<any[]>(`${this.baseUrl}/test`);
  }
}