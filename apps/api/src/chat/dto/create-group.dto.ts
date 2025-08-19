import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateGroupDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true }) memberIds!: string[];
}
