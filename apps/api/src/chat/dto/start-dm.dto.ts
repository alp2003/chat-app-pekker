import { IsNotEmpty, IsString } from "class-validator";

export class StartDmDto { @IsString() @IsNotEmpty() username!: string; }