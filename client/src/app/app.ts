import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { TestService } from './test.service';
import { NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HttpClientModule, NgFor, NgIf],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  protected readonly title = signal('my-app');
  users: any[] = [];

  constructor(private service: TestService) {}

  ngOnInit() {
    this.service.getUsers().subscribe(data => {
      this.users = data;
      console.log('Users:', this.users);
    });
  }
}