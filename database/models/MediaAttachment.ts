import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export type AttachmentType = 'photo' | 'signature' | 'document';
export type UploadStatus = 'pending' | 'uploading' | 'synced' | 'failed';

export default class MediaAttachment extends Model {
  static table = 'media_attachments';

  @text('round_id') roundId!: string;
  @text('player_external_id') playerExternalId!: string | null;
  @text('attachment_type') attachmentType!: AttachmentType;
  @text('local_path') localPath!: string;               // ruta local (file://)
  @text('remote_url') remoteUrl!: string | null;        // URL tras subida exitosa
  @text('upload_status') uploadStatus!: UploadStatus;
  @text('action_log_id') actionLogId!: string | null;   // acción que disparó el adjunto
  @text('mime_type') mimeType!: string | null;
  @field('file_size_bytes') fileSizeBytes!: number | null;
  @field('created_at') createdAt!: number;
  @field('synced_at') syncedAt!: number | null;
  @text('last_error') lastError!: string | null;

  get isPending(): boolean {
    return this.uploadStatus === 'pending' || this.uploadStatus === 'failed';
  }

  get isSignature(): boolean {
    return this.attachmentType === 'signature';
  }
}
