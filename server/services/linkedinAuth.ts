import axios from 'axios';
import { Request, Response } from 'express';


export class LinkedInOAuth {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID || '';
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
    this.redirectUri = process.env.LINKEDIN_REDIRECT_URI || '';

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.warn('LinkedIn OAuth credentials not provided. LinkedIn features will be disabled.');
    }
  }

  public getAuthorizationUrl(): string {
    // Use OpenID Connect scopes only
    const scope = 'r_liteprofile r_emailaddress w_member_social';
    const state = 'DCEeFWf45A53sdfKef424';
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;
    return authUrl;
  }

  public async handleCallback(req: Request, res: Response): Promise<void> {
    const { code, state } = req.query;

    if (state !== 'DCEeFWf45A53sdfKef424') {
      res.status(400).send('Invalid state parameter');
      return;
    }

    try {
      const accessToken = await this.getAccessToken(code as string);
      const userProfile = await this.getUserProfile(accessToken);
      
      // Store the access token for the LinkedIn API service
      process.env.LINKEDIN_ACCESS_TOKEN = accessToken;
      
      console.log('✅ LinkedIn OAuth successful! Access token stored.');
      console.log('🔗 LinkedIn API features are now enabled');
      
      // Redirect to dashboard with success message
      res.redirect('/?linkedin_auth=success');
      
    } catch (error) {
      console.error('❌ Error during LinkedIn OAuth callback:', error);
      res.redirect('/?linkedin_auth=error');
    }
  }

  private async getAccessToken(code: string): Promise<string> {
    const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', this.redirectUri);
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);

    console.log('🔄 Exchanging authorization code for access token...');
    
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('✅ Access token received successfully');
    return response.data.access_token;
  }

  private async getUserProfile(accessToken: string): Promise<any> {
    const profileUrl = 'https://api.linkedin.com/v2/userinfo';
    const response = await axios.get(profileUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  }
}
