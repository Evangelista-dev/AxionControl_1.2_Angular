import { Routes } from '@angular/router';
import { InicialComponent } from './pages/inicial/inicial.component';
import { LoginComponent } from './pages/login/login.component';
import { AdminComponent } from './pages/admin/admin.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { operadorGuard } from './guards/operador.guard';

export const routes: Routes = [
  { path: '', component: InicialComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [operadorGuard] }
];