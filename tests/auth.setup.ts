import {test as setup, expect}
from '@playwright/test';
import path from 'path';
import { LoginPage } from '../pages/LoginPage';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('autheticate', async ({page}) =>{
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('zecaurubu@yopmail.com', 'zeca123');

    await expect(page).not.toHaveURL('https://storedemo.testdino.com/login');
    //saves the state
    await page.context().storageState({path: authFile});
})