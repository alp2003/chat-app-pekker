import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsUUID() roomId!: string;
  @IsOptional() @IsString() content?: string; // defaults to ""
  @IsOptional() @IsString() clientMsgId?: string | null;
  @IsOptional() @IsString() replyToId?: string | null;
}
