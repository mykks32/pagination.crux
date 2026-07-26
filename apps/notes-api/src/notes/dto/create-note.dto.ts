/** Request body shape for `POST /v1/notes`. */
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNoteDto {
  /** Required, non-empty, capped to match the schema's `maxlength`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  /** Optional body text; defaults to an empty string at the schema level if omitted. */
  @IsOptional()
  @IsString()
  content?: string;

  /** Optional labels; capped at 20 to keep the array from growing unbounded. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
}
