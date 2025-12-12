import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgFor, NgIf } from '@angular/common';
import { TestService, TestUser } from './test.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HttpClientModule, NgFor, NgIf],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  title = signal('my-app');
  users = signal<TestUser[]>([]);

  constructor(private service: TestService) {}

  ngOnInit() {
    this.service.getUsers().subscribe(data => {
      this.users.set(data);   // עדכון ה-signal עם הנתונים מהשירות
      console.log('Users:', this.users());
    });
  }
}