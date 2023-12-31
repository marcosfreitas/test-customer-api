import {
  IsDefined,
  IsNotEmpty,
  IsNumberString,
  IsString,
} from 'class-validator';

export class CreateCustomerDto {
  @IsDefined()
  @IsNumberString()
  public document: number;

  @IsString()
  @IsNotEmpty()
  public name: string;
}
