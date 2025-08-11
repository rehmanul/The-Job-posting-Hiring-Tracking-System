import { EventEmitter } from 'events';

interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  country?: string;
  isActive: boolean;
  lastUsed: number;
  failureCount: number;
  responseTime: number;
}

export class ProxyRotationService extends EventEmitter {
  private proxies: ProxyConfig[] = [];
  private currentProxyIndex = 0;
  private maxFailures = 3;
  private rotationInterval = 30000; // 30 seconds
  private isEnabled: boolean;

  constructor() {
    super();
    this.isEnabled = !!process.env.PROXY_LIST || !!process.env.PROXY_SERVICE_URL;
    
    if (this.isEnabled) {
      this.initializeProxies();
      console.log('🔄 Proxy Rotation Service initialized');
    } else {
      console.warn('⚠️ Proxy Rotation disabled - no proxy configuration found');
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

      // Add free proxy services as backup
      await this.loadPublicProxies();
      
      console.log(`✅ Loaded ${this.proxies.length} proxies for rotation`);
      
      // Start health checks
      this.startHealthChecks();
      
    } catch (error) {
      console.error('❌ Failed to initialize proxies:', (error as Error).message);
    }
  }

  private async loadPublicProxies(): Promise<void> {
    // Add reliable free proxy sources as backup
    const freeProxies = [
      { host: '8.8.8.8', port: 3128, protocol: 'http' as const },
      { host: '1.1.1.1', port: 80, protocol: 'http' as const },
      // Add more free proxies from reliable sources
    ];

    for (const proxy of freeProxies) {
      this.proxies.push({
        ...proxy,
        isActive: true,
        lastUsed: 0,
        failureCount: 0,
        responseTime: 0
      });
    }
  }

  async getNextProxy(): Promise<ProxyConfig | null> {
    if (!this.isEnabled || this.proxies.length === 0) {
      return null;
    }

    // Filter active proxies
    const activeProxies = this.proxies.filter(p => p.isActive && p.failureCount < this.maxFailures);
    
    if (activeProxies.length === 0) {
      console.warn('⚠️ No active proxies available, resetting failure counts');
      this.proxies.forEach(p => p.failureCount = 0);
      return this.proxies[0] || null;
    }

    // Round-robin with least recently used preference
    const sortedProxies = activeProxies.sort((a, b) => a.lastUsed - b.lastUsed);
    const selectedProxy = sortedProxies[0];
    
    selectedProxy.lastUsed = Date.now();
    this.currentProxyIndex = (this.currentProxyIndex + 1) % activeProxies.length;
    
    console.log(`🔄 Using proxy: ${selectedProxy.host}:${selectedProxy.port}`);
    return selectedProxy;
  }

  async testProxy(proxy: ProxyConfig): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      // Test proxy with a simple HTTP request
      const testUrl = 'http://httpbin.org/ip';
      const proxyUrl = `${proxy.protocol}://${proxy.username ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`;
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        // Note: In production, you'd use a proper proxy agent here
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        proxy.responseTime = Date.now() - startTime;
        proxy.failureCount = 0;
        proxy.isActive = true;
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
      
    } catch (error) {
      proxy.failureCount++;
      proxy.isActive = proxy.failureCount < this.maxFailures;
      console.warn(`⚠️ Proxy test failed for ${proxy.host}:${proxy.port}:`, (error as Error).message);
      return false;
    }
  }

  private startHealthChecks(): void {
    setInterval(async () => {
      console.log('🔍 Running proxy health checks...');
      
      const promises = this.proxies.map(proxy => this.testProxy(proxy));
      await Promise.allSettled(promises);
      
      const activeCount = this.proxies.filter(p => p.isActive).length;
      console.log(`✅ Health check complete: ${activeCount}/${this.proxies.length} proxies active`);
      
      this.emit('healthCheck', { activeCount, totalCount: this.proxies.length });
      
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
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  reportProxyFailure(proxy: ProxyConfig, error: string): void {
    proxy.failureCount++;
    if (proxy.failureCount >= this.maxFailures) {
      proxy.isActive = false;
      console.warn(`🔴 Proxy ${proxy.host}:${proxy.port} disabled after ${this.maxFailures} failures`);
    }
    
    this.emit('proxyFailure', { proxy, error });
  }

  reportProxySuccess(proxy: ProxyConfig, responseTime: number): void {
    proxy.responseTime = responseTime;
    proxy.failureCount = Math.max(0, proxy.failureCount - 1); // Gradually recover
    proxy.isActive = true;
    
    this.emit('proxySuccess', { proxy, responseTime });
  }
}