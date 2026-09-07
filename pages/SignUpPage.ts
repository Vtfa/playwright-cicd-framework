import {expect, type Locator, type Page} from '@playwright/test';

export class SignUpPage {
    readonly page: Page;
    readonly nameInput: Locator;
    readonly lastNameInput: Locator;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly createAccountButton: Locator;
    readonly sucessToast: Locator;


    constructor(page: Page){
        this.page = page;
        this.nameInput = page.getByTestId('signup-firstname-input');
        this.lastNameInput = page.getByLabel('Last Name');
        this.emailInput = page.getByTestId('signup-email-input');
        this.passwordInput = page.getByTestId('signup-password-input');
        this.createAccountButton = page.getByRole('button', {name: 'Create Account'});
        this.sucessToast = page.getByText('Account created successfully! Please login to continue.');
    }
    

    async goto(){
        await this.page.goto('https://storedemo.testdino.com/signup')
    }

    async signUp(name: string, lastName: string, email:string, password: string){
        await this.nameInput.fill(name);
        await this.lastNameInput.fill(lastName);
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.createAccountButton.click();
        await expect(this.sucessToast).toBeVisible({timeout: 15000});
        await expect(this.sucessToast).toBeHidden({timeout: 15000});
    }
}