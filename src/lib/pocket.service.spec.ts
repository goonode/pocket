import { TestBed } from '@angular/core/testing';

import { PocketService } from './pocket.service';

describe('PocketService', () => {
  let service: PocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
