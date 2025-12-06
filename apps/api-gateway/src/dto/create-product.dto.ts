import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class CreateProductDto {

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  price: number;
}
