import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const operadorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isOperadorLoggedIn() || auth.isAdminLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
