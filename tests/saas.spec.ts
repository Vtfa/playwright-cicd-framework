import {test, expect} from '@playwright/test'
import { LoginPage } from '../pages/LoginPage';
import { SignUpPage } from '../pages/SignUpPage';


// Run tests in this file as unauthenticated guest (ignore global user.json)
test.use({ storageState: { cookies: [], origins: [] } });

test('create account', {tag: '@smoke'}, async({page}) =>{
    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    const uniqueEmail = `zeca_${Date.now()}@email.com`

    await signUpPage.signUp('zeca', 'urubu', uniqueEmail, '123123123');
});


test('log into account', {tag:'@regression'}, async({page}) =>{
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('zecaurubu@yopmail.com', 'zeca123');
    
    // Assert redirect away from login page
    await expect(page).not.toHaveURL(/.*login/);
});