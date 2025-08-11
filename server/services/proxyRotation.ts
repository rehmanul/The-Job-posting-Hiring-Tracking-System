import { EventEmitter } from 'events';
import axios from 'axios';

interface Proxy {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  isActive: boolean;
  lastUsed: number;
  failureCount: number;
  responseTime: number;
}

export class ProxyRotationService extends EventEmitter {
  private proxies: Proxy[] = [];
  private currentIndex = 0;
  private isEnabled = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Proxy Rotation Service...');

      await this.initializeProxies();

      if (this.proxies.length === 0) {
        console.warn('⚠️ Proxy Rotation disabled - no proxy configuration found');
        this.isEnabled = false;
        return;
      }

      // Test initial proxy health
      await this.performHealthChecks();

      this.startHealthChecks();
      this.isEnabled = true;

      console.log(`✅ Proxy Rotation Service initialized with ${this.proxies.length} proxies`);

    } catch (error) {
      console.error('❌ Failed to initialize Proxy Rotation Service:', error);
      this.isEnabled = false;
    }
  }

  private async initializeProxies(): Promise<void> {
    try {
      // Load proxies from environment or external service
      if (process.env.PROXY_LIST) {
        // Format: "host1:port1:user1:pass1,host2:port2:user2:pass2"
        const proxyStrings = process.env.PROXY_LIST.split(',');

        for (const proxyStr of proxyStrings) {
          const [host, port, username, password] = proxyStr.trim().split(':');
          if (host && port) {
            this.proxies.push({
              host,
              port: parseInt(port),
              username,
              password,
              protocol: 'http',
              isActive: true,
              lastUsed: 0,
              failureCount: 0,
              responseTime: 0
            });
          }
        }
      }

      // Load from external proxy API services if configured
      if (process.env.PROXY_API_URL && process.env.PROXY_API_KEY) {
        await this.loadFromProxyAPI();
      }

      // Add reliable residential proxy services if configured
      if (process.env.BRIGHTDATA_USERNAME && process.env.BRIGHTDATA_PASSWORD) {
        this.addBrightDataProxies();
      }

      if (process.env.OXYLABS_USERNAME && process.env.OXYLABS_PASSWORD) {
        this.addOxylabsProxies();
      }

      console.log(`✅ Loaded ${this.proxies.length} proxies for rotation`);

    } catch (error) {
      console.error('❌ Failed to initialize proxies:', (error as Error).message);
    }
  }

  private async loadFromProxyAPI(): Promise<void> {
    try {
      const response = await axios.get(process.env.PROXY_API_URL!, {
        headers: {
          'Authorization': `Bearer ${process.env.PROXY_API_KEY}`
        },
        timeout: 10000
      });

      const apiProxies = response.data.proxies || response.data;

      for (const proxy of apiProxies) {
        if (proxy.host && proxy.port) {
          this.proxies.push({
            host: proxy.host,
            port: parseInt(proxy.port),
            username: proxy.username,
            password: proxy.password,
            protocol: proxy.protocol || 'http',
            isActive: true,
            lastUsed: 0,
            failureCount: 0,
            responseTime: 0
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load proxies from API:', error);
    }
  }

  private addBrightDataProxies(): void {
    // BrightData residential proxies
    const brightDataEndpoints = [
      'brd-customer-hl_username-zone-residential_proxy1.zproxy.lum-superproxy.io:22225',
      'brd-customer-hl_username-zone-datacenter_proxy1.zproxy.lum-superproxy.io:22225'
    ];

    for (const endpoint of brightDataEndpoints) {
      const [host, port] = endpoint.split(':');
      this.proxies.push({
        host,
        port: parseInt(port),
        username: process.env.BRIGHTDATA_USERNAME,
        password: process.env.BRIGHTDATA_PASSWORD,
        protocol: 'http',
        isActive: true,
        lastUsed: 0,
        failureCount: 0,
        responseTime: 0
      });
    }
  }

  private addOxylabsProxies(): void {
    // Oxylabs residential proxies
    const oxylabsEndpoints = [
      'pr.oxylabs.io:7777',
      'dc.oxylabs.io:8001'
    ];

    for (const endpoint of oxylabsEndpoints) {
      const [host, port] = endpoint.split(':');
      this.proxies.push({
        host,
        port: parseInt(port),
        username: process.env.OXYLABS_USERNAME,
        password: process.env.OXYLABS_PASSWORD,
        protocol: 'http',
        isActive: true,
        lastUsed: 0,
        failureCount: 0,
        responseTime: 0
      });
    }
  }

  async getNextProxy(): Promise<Proxy | null> {
    if (!this.isEnabled || this.proxies.length === 0) {
      return null;
    }

    const activeProxies = this.proxies.filter(p => p.isActive);

    if (activeProxies.length === 0) {
      console.warn('⚠️ No active proxies available');
      return null;
    }

    // Round-robin with preference for least recently used
    const sortedProxies = activeProxies.sort((a, b) => a.lastUsed - b.lastUsed);
    const selectedProxy = sortedProxies[0];

    selectedProxy.lastUsed = Date.now();

    return selectedProxy;
  }

  async testProxy(proxy: Proxy): Promise<boolean> {
    const startTime = Date.now();

    try {
      const proxyConfig = {
        host: proxy.host,
        port: proxy.port,
        auth: proxy.username ? {
          username: proxy.username,
          password: proxy.password || ''
        } : undefined
      };

      const response = await axios.get('https://httpbin.org/ip', {
        proxy: proxyConfig,
        timeout: 10000
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200 && response.data.origin) {
        proxy.isActive = true;
        proxy.failureCount = 0;
        proxy.responseTime = responseTime;

        console.log(`✅ Proxy ${proxy.host}:${proxy.port} is working (${responseTime}ms)`);
        return true;
      }
    } catch (error) {
      proxy.failureCount++;
      proxy.responseTime = Date.now() - startTime;

      // Disable proxy after 3 consecutive failures
      if (proxy.failureCount >= 3) {
        proxy.isActive = false;
        console.warn(`❌ Disabled proxy ${proxy.host}:${proxy.port} after ${proxy.failureCount} failures`);
      }

      console.warn(`⚠️ Proxy test failed for ${proxy.host}:${proxy.port}:`, (error as Error).message);
    }

    return false;
  }

  private async performHealthChecks(): Promise<void> {
    console.log('🔍 Running proxy health checks...');

    const promises = this.proxies.map(proxy => this.testProxy(proxy));
    await Promise.allSettled(promises);

    const activeCount = this.proxies.filter(p => p.isActive).length;
    console.log(`✅ Health check complete: ${activeCount}/${this.proxies.length} proxies active`);

    this.emit('healthCheck', { activeCount, totalCount: this.proxies.length });
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  getProxyStats(): { total: number; active: number; avgResponseTime: number } {
    const activeProxies = this.proxies.filter(p => p.isActive);
    const avgResponseTime = activeProxies.length > 0 
      ? activeProxies.reduce((sum, p) => sum + p.responseTime, 0) / activeProxies.length 
      : 0;

    return {
      total: this.proxies.length,
      active: activeProxies.length,
      avgResponseTime: Math.round(avgResponseTime)
    };
  }

  async rotateUserAgent(): Promise<string> {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];

    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  async cleanup(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.proxies = [];
    this.isEnabled = false;

    console.log('🧹 Proxy Rotation Service cleanup complete');
  }
}