import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email address provided' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email address provided' })
  email: string;

  @IsString()
  password: string;
}