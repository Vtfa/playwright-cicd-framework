import {expect, type Locator, type Page} from '@playwright/test';

export class LoginPage{
    readonly page: Page;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly signInButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.emailInput = page.getByTestId('login-email-input');
        this.passwordInput = page.getByLabel('password');
        this.signInButton = page.getByRole('button', {name: 'Sign in'});
    }

    async goto(){
        await this.page.goto('https://storedemo.testdino.com/login');
    }

    async login(email: string, pass: string){
        await this.emailInput.fill(email);
        await this.passwordInput.fill(pass);
        await this.signInButton.click();
    }
}